import { Application, Container } from 'pixi.js';
import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Game } from '../game';
import { World, WorldObject } from '../world';
import { AbstractGraphics } from './abstract-graphics';
import type { GraphicsOptions } from './abstract-graphics.types';
import { defineLayers } from './layer-set.support';
import { LayerSet } from './layer-set';
import { Scene } from './scene';

// Minimal concrete graphics wrapping a bare Pixi Container, just enough to
// exercise the layer-parenting and lifecycle logic owned by AbstractGraphics.
class TestGraphics extends AbstractGraphics<Container> {
  constructor(host: WorldObject, options: GraphicsOptions = {}) {
    super(host, new Container(), options);
  }
}

function createFakeApp(): Application {
  return {
    stage: new Container(),
    screen: { width: 800, height: 600 },
    renderer: { events: { pointer: { global: { x: 0, y: 0 } } } },
  } as unknown as Application;
}

function createWorld(layers?: LayerSet) {
  const app = createFakeApp();
  const world = new World(Game.createHeadless(), {
    components: (world) => ({
      scene: () => new Scene(world, app, layers),
    }),
  });

  return { world, scene: world.getComponentByType(Scene) };
}

function errorCode(fn: () => unknown): ErrorCode | undefined {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    return (error as EngineError).code;
  }

  return undefined;
}

describe('AbstractGraphics layering', () => {
  const LAYERS = defineLayers('ground', 'structures', 'ui');

  describe('layer-less world', () => {
    test('parents straight onto the scene root and detaches on destroy', () => {
      const { world, scene } = createWorld();
      const object = world.createEmpty();
      const graphics = new TestGraphics(object);

      object.addComponent('graphics', graphics);
      expect(scene.raw.children).toContain(graphics.raw);

      object.destroy();
      world.update();
      expect(scene.raw.children).not.toContain(graphics.raw);
    });

    test('throws LAYER_SET_ABSENT when a layer is named anyway', () => {
      const { world } = createWorld();
      const object = world.createEmpty();
      const graphics = new TestGraphics(object, {
        layer: LAYERS.get('ground'),
      });

      expect(errorCode(() => object.addComponent('graphics', graphics))).toBe(
        ErrorCode.LAYER_SET_ABSENT,
      );
    });
  });

  describe('layered world', () => {
    test('parents into the named layer container, not the scene root', () => {
      const { world, scene } = createWorld(LAYERS);
      const object = world.createEmpty();
      const graphics = new TestGraphics(object, {
        layer: LAYERS.get('structures'),
      });

      object.addComponent('graphics', graphics);

      const bucket = scene.containerForLayer(LAYERS.get('structures'));
      expect(bucket.children).toContain(graphics.raw);
      expect(scene.raw.children).not.toContain(graphics.raw);
    });

    test('throws LAYER_UNSPECIFIED when no layer is named', () => {
      const { world } = createWorld(LAYERS);
      const object = world.createEmpty();
      const graphics = new TestGraphics(object);

      expect(errorCode(() => object.addComponent('graphics', graphics))).toBe(
        ErrorCode.LAYER_UNSPECIFIED,
      );
    });

    test('cross-layer order is independent of spawn order', () => {
      const { world, scene } = createWorld(LAYERS);

      // Spawn the UI graphic first, the ground graphic second.
      const top = world.createEmpty();
      top.addComponent(
        'graphics',
        new TestGraphics(top, { layer: LAYERS.get('ui') }),
      );
      const bottom = world.createEmpty();
      bottom.addComponent(
        'graphics',
        new TestGraphics(bottom, { layer: LAYERS.get('ground') }),
      );

      // Draw order is fixed by layer order: the ground bucket still sorts below
      // the ui bucket despite the ui graphic being added first.
      const groundBucket = scene.containerForLayer(LAYERS.get('ground'));
      const uiBucket = scene.containerForLayer(LAYERS.get('ui'));
      expect(groundBucket.zIndex).toBeLessThan(uiBucket.zIndex);
    });

    test('within a layer, insertion order is preserved', () => {
      const { world, scene } = createWorld(LAYERS);

      const first = world.createEmpty();
      const firstGraphics = new TestGraphics(first, {
        layer: LAYERS.get('structures'),
      });
      first.addComponent('graphics', firstGraphics);

      const second = world.createEmpty();
      const secondGraphics = new TestGraphics(second, {
        layer: LAYERS.get('structures'),
      });
      second.addComponent('graphics', secondGraphics);

      const bucket = scene.containerForLayer(LAYERS.get('structures'));
      expect(bucket.children).toEqual([firstGraphics.raw, secondGraphics.raw]);
    });

    test('onDestroy empties the graphic from its layer container', () => {
      const { world, scene } = createWorld(LAYERS);
      const object = world.createEmpty();
      const graphics = new TestGraphics(object, {
        layer: LAYERS.get('ground'),
      });
      object.addComponent('graphics', graphics);

      const bucket = scene.containerForLayer(LAYERS.get('ground'));
      expect(bucket.children).toContain(graphics.raw);

      object.destroy();
      world.update();
      expect(bucket.children).not.toContain(graphics.raw);
    });
  });

  describe('layer setter', () => {
    test('re-parents a mounted graphic between layers', () => {
      const { world, scene } = createWorld(LAYERS);
      const object = world.createEmpty();
      const graphics = new TestGraphics(object, {
        layer: LAYERS.get('ground'),
      });
      object.addComponent('graphics', graphics);

      graphics.layer = LAYERS.get('ui');

      expect(graphics.layer).toBe(LAYERS.get('ui'));
      expect(
        scene.containerForLayer(LAYERS.get('ground')).children,
      ).not.toContain(graphics.raw);
      expect(scene.containerForLayer(LAYERS.get('ui')).children).toContain(
        graphics.raw,
      );
    });

    test('a layer chosen before mount is applied on add', () => {
      const { world, scene } = createWorld(LAYERS);
      const object = world.createEmpty();
      const graphics = new TestGraphics(object, {
        layer: LAYERS.get('ground'),
      });

      // Change the choice before the component is added (nothing parented yet).
      graphics.layer = LAYERS.get('ui');
      object.addComponent('graphics', graphics);

      expect(scene.containerForLayer(LAYERS.get('ui')).children).toContain(
        graphics.raw,
      );
    });

    test('throws LAYER_NOT_IN_SET when set to a foreign token', () => {
      const { world } = createWorld(LAYERS);
      const object = world.createEmpty();
      const graphics = new TestGraphics(object, {
        layer: LAYERS.get('ground'),
      });
      object.addComponent('graphics', graphics);

      const foreign = defineLayers('ground').get('ground');
      expect(errorCode(() => (graphics.layer = foreign))).toBe(
        ErrorCode.LAYER_NOT_IN_SET,
      );
    });
  });
});
