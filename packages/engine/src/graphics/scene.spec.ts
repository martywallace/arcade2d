import { Application, Container } from 'pixi.js';
import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Game } from '../game';
import { World } from '../world';
import { defineLayers } from './layer-set.support';
import { Scene } from './scene';

function createFakeApp(width = 800, height = 600): Application {
  return {
    stage: new Container(),
    screen: { width, height },
    renderer: {
      events: { pointer: { global: { x: 0, y: 0 } } },
    },
  } as unknown as Application;
}

function createWorldWithScene(width?: number, height?: number) {
  const app = createFakeApp(width, height);
  const world = new World(Game.createHeadless(), {
    components: (world) => ({
      scene: () => new Scene(world, app),
    }),
  });

  return { world, scene: world.getComponentByType(Scene), app };
}

describe('Scene', () => {
  test('raw returns the wrapped Pixi Container', () => {
    const { scene } = createWorldWithScene();

    expect(scene.raw).toBeInstanceOf(Container);
  });

  test('mounts its container under the application stage on add', () => {
    const { scene, app } = createWorldWithScene();

    expect(app.stage.children).toContain(scene.raw);
  });

  test('addChild and removeChild proxy to the wrapped container', () => {
    const { scene } = createWorldWithScene();
    const child = new Container();

    scene.addChild(child);
    expect(scene.raw.children).toContain(child);

    scene.removeChild(child);
    expect(scene.raw.children).not.toContain(child);
  });

  test('detaches its container from the stage on destroy', () => {
    const { scene, app, world } = createWorldWithScene();

    world.removeComponent('scene');

    expect(app.stage.children).not.toContain(scene.raw);
  });

  test('destroys its container tree on destroy so it is not leaked', () => {
    const { scene, world } = createWorldWithScene();
    const container = scene.raw;

    world.removeComponent('scene');

    // Without the destroy, the root container (and any per-layer buckets)
    // leak on every world teardown — level transitions, restarts.
    expect(container.destroyed).toBe(true);
  });

  test('destroys per-layer bucket containers on destroy', () => {
    const app = createFakeApp();
    const layers = defineLayers('ground', 'characters');
    const world = new World(Game.createHeadless(), {
      layers,
      components: (world) => ({
        scene: () => new Scene(world, app, layers),
      }),
    });
    const scene = world.getComponentByType(Scene);
    const bucket = scene.containerForLayer(layers.get('ground'));

    world.removeComponent('scene');

    expect(bucket.destroyed).toBe(true);
  });

  test('default camera frames world origin at the canvas centre after one tick', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.update();

    expect(scene.raw.pivot.x).toBe(0);
    expect(scene.raw.pivot.y).toBe(0);
    expect(scene.raw.x).toBe(400);
    expect(scene.raw.y).toBe(300);
    expect(scene.raw.rotation).toBe(0);
  });

  test('camera position becomes the container pivot each tick', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.position.set(150, 75);
    world.update();

    expect(scene.raw.pivot.x).toBe(150);
    expect(scene.raw.pivot.y).toBe(75);
    // Container still anchors to the canvas centre — pivot, not container x,
    // is what shifts when the camera moves.
    expect(scene.raw.x).toBe(400);
    expect(scene.raw.y).toBe(300);
  });

  test('camera rotation applies its inverse to the container', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.rotation = Math.PI / 4;
    world.update();

    expect(scene.raw.rotation).toBeCloseTo(-Math.PI / 4);
  });

  test('post-update reframes after each camera mutation', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.position.set(10, 20);
    world.update();
    expect(scene.raw.pivot.x).toBe(10);

    world.camera.position.set(99, 11);
    world.update();
    expect(scene.raw.pivot.x).toBe(99);
    expect(scene.raw.pivot.y).toBe(11);
  });

  test('camera zoom maps to the container scale', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.zoom = 2;
    world.update();

    expect(scene.raw.scale.x).toBe(2);
    expect(scene.raw.scale.y).toBe(2);
  });

  test('camera shake offset adds to the container position, not the pivot', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    // Pin Math.random so the shake produces a deterministic offset of (-5, 0)
    // — see camera.spec.ts for the reasoning.
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      world.camera.shake(10, 1000);
      world.update();

      // Pivot stays on the camera's logical position, not pushed around by
      // the shake.
      expect(scene.raw.pivot.x).toBe(0);
      expect(scene.raw.pivot.y).toBe(0);
      // Container position is canvas centre + shake offset.
      expect(scene.raw.x).toBeCloseTo(400 + -5);
      expect(scene.raw.y).toBeCloseTo(300);
    } finally {
      randomSpy.mockRestore();
    }
  });

  describe('worldToScreen / screenToWorld', () => {
    test('default camera maps world origin to canvas centre', () => {
      const { scene } = createWorldWithScene(800, 600);

      const screen = scene.worldToScreen({ x: 0, y: 0 });

      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    test('camera position shifts the mapping', () => {
      const { scene, world } = createWorldWithScene(800, 600);
      world.camera.position.set(100, 50);

      const screen = scene.worldToScreen({ x: 100, y: 50 });

      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    test('camera zoom scales the mapping', () => {
      const { scene, world } = createWorldWithScene(800, 600);
      world.camera.zoom = 2;

      // A world point 10 units right of the camera lands 20 pixels right of
      // the canvas centre at 2x zoom.
      const screen = scene.worldToScreen({ x: 10, y: 0 });

      expect(screen.x).toBe(420);
      expect(screen.y).toBe(300);
    });

    test('worldToScreen and screenToWorld are inverses', () => {
      const { scene, world } = createWorldWithScene(800, 600);
      world.camera.position.set(33, -17);
      world.camera.rotation = 0.7;
      world.camera.zoom = 1.5;

      const worldPoint = { x: 42, y: 99 };
      const roundTripped = scene.screenToWorld(scene.worldToScreen(worldPoint));

      expect(roundTripped.x).toBeCloseTo(worldPoint.x);
      expect(roundTripped.y).toBeCloseTo(worldPoint.y);
    });

    test('uses logical camera state (ignores shake)', () => {
      const { scene, world } = createWorldWithScene(800, 600);

      // With Math.random pinned to 0.5, shake offset is (-5, 0).
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      try {
        world.camera.shake(10, 1000);
        world.update();

        // Despite a shake being in flight, worldToScreen ignores it — the
        // conversion remains a clean inverse of screenToWorld.
        const screen = scene.worldToScreen({ x: 0, y: 0 });
        expect(screen.x).toBe(400);
        expect(screen.y).toBe(300);
      } finally {
        randomSpy.mockRestore();
      }
    });
  });

  describe('layers', () => {
    const LAYERS = defineLayers('ground', 'structures', 'ui');

    function createLayeredScene(width?: number, height?: number) {
      const app = createFakeApp(width, height);
      const world = new World(Game.createHeadless(), {
        components: (world) => ({
          scene: () => new Scene(world, app, LAYERS),
        }),
      });

      return { world, scene: world.getComponentByType(Scene), app };
    }

    test('hasLayers is false without a layer set, true with one', () => {
      expect(createWorldWithScene().scene.hasLayers).toBe(false);
      expect(createLayeredScene().scene.hasLayers).toBe(true);
    });

    test('builds one container per layer, parented under raw in order', () => {
      const { scene } = createLayeredScene();

      const buckets = LAYERS.layers.map((layer) =>
        scene.containerForLayer(layer),
      );

      // The layer containers are the direct children of the scene root, in
      // back-to-front order.
      expect(scene.raw.children).toEqual(buckets);
    });

    test('layer containers carry an ascending zIndex and raw sorts children', () => {
      const { scene } = createLayeredScene();

      expect(scene.raw.sortableChildren).toBe(true);
      expect(
        LAYERS.layers.map((layer) => scene.containerForLayer(layer).zIndex),
      ).toEqual([0, 1, 2]);
    });

    test('layer containers stay at identity after a camera tick', () => {
      const { scene, world } = createLayeredScene(800, 600);

      world.camera.position.set(150, 75);
      world.camera.zoom = 2;
      world.update();

      // The camera transform lands on the scene root, never on a layer bucket —
      // so a graphic's baked world matrix means the same thing in any bucket.
      for (const layer of LAYERS.layers) {
        const bucket = scene.containerForLayer(layer);
        expect(bucket.position.x).toBe(0);
        expect(bucket.position.y).toBe(0);
        expect(bucket.pivot.x).toBe(0);
        expect(bucket.pivot.y).toBe(0);
        expect(bucket.rotation).toBe(0);
        expect(bucket.scale.x).toBe(1);
        expect(bucket.scale.y).toBe(1);
      }
    });

    test('containerForLayer throws LAYER_NOT_IN_SET for a foreign token', () => {
      const { scene } = createLayeredScene();
      const foreign = defineLayers('ground').get('ground');

      let caught: unknown;
      try {
        scene.containerForLayer(foreign);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(ErrorCode.LAYER_NOT_IN_SET);
    });

    test('containerForLayer throws LAYER_NOT_IN_SET on a layer-less scene', () => {
      const { scene } = createWorldWithScene();
      const layer = LAYERS.get('ground');

      let caught: unknown;
      try {
        scene.containerForLayer(layer);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(ErrorCode.LAYER_NOT_IN_SET);
    });
  });
});
