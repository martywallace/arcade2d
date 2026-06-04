import RAPIER from '@dimforge/rapier2d-compat';
import { Game } from '../game';
import { Point } from '../geometry';
import { World, WorldUpdate } from '../world';
import { PhysicsWorld } from './physics-world';
import { PhysicsWorldOptions } from './physics-world.types';
import { initPhysics } from './physics.support';

beforeAll(async () => {
  await initPhysics();
});

function createPhysicsWorld(options?: PhysicsWorldOptions): {
  world: World;
  physics: PhysicsWorld;
} {
  const world = new World(Game.createHeadless(), {
    components: (w) => ({
      physics: () => new PhysicsWorld(w, options),
    }),
  });

  return { world, physics: world.getComponentByType(PhysicsWorld) };
}

// onPreUpdate only reads `deltaSeconds`, so a minimal cast keeps stepping
// tests deterministic instead of depending on wall-clock frame timing.
function tick(seconds: number): WorldUpdate {
  return { deltaSeconds: seconds } as WorldUpdate;
}

describe('PhysicsWorld', () => {
  test('throws PHYSICS_NOT_INITIALISED is covered by physics.support; here Rapier is ready', () => {
    expect(() => createPhysicsWorld()).not.toThrow();
  });

  test('raw exposes the underlying Rapier world', () => {
    const { physics } = createPhysicsWorld();

    expect(physics.raw).toBeInstanceOf(RAPIER.World);
  });

  describe('gravity', () => {
    test('defaults to 980 down the screen', () => {
      const { physics } = createPhysicsWorld();

      expect(physics.gravity).toBeInstanceOf(Point);
      expect(physics.gravity.x).toBe(0);
      expect(physics.gravity.y).toBe(980);
    });

    test('honours a custom gravity option', () => {
      const { physics } = createPhysicsWorld({ gravity: { x: -10, y: 0 } });

      expect(physics.gravity.x).toBe(-10);
      expect(physics.gravity.y).toBe(0);
    });

    test('setter updates the simulation', () => {
      const { physics } = createPhysicsWorld();

      physics.gravity = { x: 3, y: 4 };

      expect(physics.raw.gravity.x).toBe(3);
      expect(physics.raw.gravity.y).toBe(4);
      expect(physics.gravity.y).toBe(4);
    });
  });

  describe('configuration', () => {
    test('pixelsPerMeter maps to Rapier lengthUnit (default 50)', () => {
      expect(createPhysicsWorld().physics.raw.lengthUnit).toBe(50);
      expect(
        createPhysicsWorld({ pixelsPerMeter: 100 }).physics.raw.lengthUnit,
      ).toBe(100);
    });

    test('fixedTimeStep defaults to 1/60 and is configurable', () => {
      expect(createPhysicsWorld().physics.fixedTimeStep).toBeCloseTo(1 / 60);

      const custom = createPhysicsWorld({ fixedTimeStep: 1 / 120 });
      expect(custom.physics.fixedTimeStep).toBeCloseTo(1 / 120);
      expect(custom.physics.raw.timestep).toBeCloseTo(1 / 120);
    });
  });

  describe('stepping', () => {
    test('does not step until a whole fixed timestep has accumulated', () => {
      const { physics } = createPhysicsWorld();
      const step = jest.spyOn(physics.raw, 'step');

      physics.onPreUpdate(tick(1 / 240));

      expect(step).not.toHaveBeenCalled();
    });

    test('runs one step per accumulated fixed timestep', () => {
      const { physics } = createPhysicsWorld();
      const step = jest.spyOn(physics.raw, 'step');

      physics.onPreUpdate(tick(3 / 60));

      expect(step).toHaveBeenCalledTimes(3);
    });

    test('caps catch-up steps at maxSubSteps to avoid a spiral of death', () => {
      const { physics } = createPhysicsWorld({ maxSubSteps: 4 });
      const step = jest.spyOn(physics.raw, 'step');

      // A 1-second stall would owe 60 steps; the cap clamps it.
      physics.onPreUpdate(tick(1));

      expect(step).toHaveBeenCalledTimes(4);
    });

    test('integrates a dynamic body downward under gravity', () => {
      const { physics } = createPhysicsWorld();
      const body = physics.raw.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0),
      );
      physics.raw.createCollider(RAPIER.ColliderDesc.ball(10), body);

      const startY = body.translation().y;

      for (let i = 0; i < 30; i++) {
        physics.onPreUpdate(tick(1 / 60));
      }

      expect(body.translation().y).toBeGreaterThan(startY);
    });
  });

  test('onDestroy frees the underlying Rapier world', () => {
    const { physics } = createPhysicsWorld();
    const free = jest.spyOn(physics.raw, 'free');

    physics.onDestroy();

    expect(free).toHaveBeenCalledTimes(1);
  });
});
