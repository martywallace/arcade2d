import { Application, Container } from 'pixi.js';
import { Game } from '../game';
import { Scene } from '../graphics';
import { ErrorCode } from '../error.constants';
import { EngineError } from '../error';
import { World } from '../world';
import { PhysicsWorld } from './physics-world';
import { PhysicsDebugRenderer } from './physics-debug-renderer';
import { PhysicsDebugRendererOptions } from './physics-debug-renderer.types';
import { DEBUG_OVERLAY_Z_INDEX } from './physics-debug-renderer.constants';
import { initPhysics } from './physics.support';

beforeAll(async () => {
  await initPhysics();
});

function createFakeApp(width = 800, height = 600): Application {
  return {
    stage: new Container(),
    screen: { width, height },
    renderer: {
      events: { pointer: { global: { x: 0, y: 0 } } },
    },
  } as unknown as Application;
}

function setup(options?: PhysicsDebugRendererOptions) {
  const app = createFakeApp();
  const world = new World(Game.createHeadless(), {
    components: (w) => ({
      scene: () => new Scene(w, app),
      physics: () => new PhysicsWorld(w),
      debug: () => new PhysicsDebugRenderer(w, options),
    }),
  });

  return {
    world,
    app,
    scene: world.getComponentByType(Scene),
    physics: world.getComponentByType(PhysicsWorld),
    debug: world.getComponentByType(PhysicsDebugRenderer),
  };
}

// One horizontal segment from (0,0) to (10,0), both endpoints red and opaque.
const ONE_RED_SEGMENT = {
  vertices: new Float32Array([0, 0, 10, 0]),
  colors: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1]),
};

describe('PhysicsDebugRenderer', () => {
  describe('dependencies', () => {
    test('throws WORLD_COMPONENT_DEPENDENCY_MISSING when the world has no PhysicsWorld', () => {
      const app = createFakeApp();

      let caught: unknown;

      try {
        new World(Game.createHeadless(), {
          components: (w) => ({
            scene: () => new Scene(w, app),
            debug: () => new PhysicsDebugRenderer(w),
          }),
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(
        ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING,
      );
    });
  });

  describe('mounting', () => {
    test('adds its overlay to the scene on add', () => {
      const { scene, debug } = setup();

      expect(scene.raw.children).toContain(debug.raw);
    });

    test('sorts the overlay above body graphics', () => {
      const { scene, debug } = setup();

      expect(debug.raw.zIndex).toBe(DEBUG_OVERLAY_Z_INDEX);
      expect(scene.raw.sortableChildren).toBe(true);
    });

    test('destroy is safe before the component was ever added', () => {
      const app = createFakeApp();
      const world = new World(Game.createHeadless(), {
        components: (w) => ({
          scene: () => new Scene(w, app),
          physics: () => new PhysicsWorld(w),
        }),
      });
      const renderer = new PhysicsDebugRenderer(world);
      const destroy = jest.spyOn(renderer.raw, 'destroy');

      expect(() => renderer.onDestroy()).not.toThrow();
      expect(destroy).toHaveBeenCalledTimes(1);
    });

    test('removes and destroys the overlay on destroy', () => {
      const { world, scene, debug } = setup();
      const overlay = debug.raw;
      const destroy = jest.spyOn(overlay, 'destroy');

      world.removeComponent('debug');

      expect(scene.raw.children).not.toContain(overlay);
      expect(destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('drawing', () => {
    test('clears and re-strokes the debug segments each post-update', () => {
      const { world, physics, debug } = setup();
      jest.spyOn(physics.raw, 'debugRender').mockReturnValue(ONE_RED_SEGMENT);

      const clear = jest.spyOn(debug.raw, 'clear');
      const moveTo = jest.spyOn(debug.raw, 'moveTo');
      const lineTo = jest.spyOn(debug.raw, 'lineTo');
      const stroke = jest.spyOn(debug.raw, 'stroke');

      world.update();

      expect(clear).toHaveBeenCalledTimes(1);
      expect(moveTo).toHaveBeenCalledWith(0, 0);
      expect(lineTo).toHaveBeenCalledWith(10, 0);
      expect(stroke).toHaveBeenCalledTimes(1);
    });

    test('uses the per-segment Rapier colour when no override is given', () => {
      const { world, physics, debug } = setup();
      jest.spyOn(physics.raw, 'debugRender').mockReturnValue(ONE_RED_SEGMENT);

      const stroke = jest.spyOn(debug.raw, 'stroke');

      world.update();

      expect(stroke).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xff0000, alpha: 1 }),
      );
    });

    test('strokes every segment in a single flat colour when overridden', () => {
      const { world, physics, debug } = setup({
        color: 0x00ff00,
        lineWidth: 3,
      });
      jest.spyOn(physics.raw, 'debugRender').mockReturnValue({
        // Two segments; with an override both share one stroke call.
        vertices: new Float32Array([0, 0, 10, 0, 10, 0, 10, 10]),
        colors: new Float32Array(16),
      });

      const stroke = jest.spyOn(debug.raw, 'stroke');

      world.update();

      expect(stroke).toHaveBeenCalledTimes(1);
      expect(stroke).toHaveBeenCalledWith({ width: 3, color: 0x00ff00 });
    });

    test('draws nothing but still clears when the simulation is empty', () => {
      const { world, physics, debug } = setup();
      jest.spyOn(physics.raw, 'debugRender').mockReturnValue({
        vertices: new Float32Array([]),
        colors: new Float32Array([]),
      });

      const clear = jest.spyOn(debug.raw, 'clear');
      const stroke = jest.spyOn(debug.raw, 'stroke');

      world.update();

      expect(clear).toHaveBeenCalledTimes(1);
      expect(stroke).not.toHaveBeenCalled();
    });
  });
});
