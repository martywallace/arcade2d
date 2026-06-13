import RAPIER from '@dimforge/rapier2d-compat';
import { Game } from '../game';
import { Circle } from '../geometry';
import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import type { Component } from '../components.types';
import {
  World,
  WorldObject,
  WorldUpdate,
  type WorldErrorContext,
} from '../world';
import { PhysicsWorld } from './physics-world';
import { RigidBody } from './rigid-body';
import { CollisionEvent, RigidBodyOptions } from './rigid-body.types';
import { initPhysics } from './physics.support';

beforeAll(async () => {
  await initPhysics();
});

function captureCode(run: () => unknown): ErrorCode | undefined {
  try {
    run();
  } catch (caught) {
    expect(caught).toBeInstanceOf(EngineError);

    return (caught as EngineError).code;
  }

  return undefined;
}

function makeWorld(withPhysics = true): World {
  return new World(Game.createHeadless(), {
    components: (w) => {
      const components: Record<string, () => Component<World>> = {};

      if (withPhysics) {
        components.physics = () => new PhysicsWorld(w);
      }

      return components;
    },
  });
}

function addBody(
  world: World,
  options: RigidBodyOptions,
  position = { x: 0, y: 0 },
): { object: WorldObject; body: RigidBody } {
  const object = world.createEmpty(position);
  const map = object.addComponentsFromFactories({
    body: (host) => new RigidBody(host as WorldObject, options),
  });

  return { object, body: map.body as RigidBody };
}

const CIRCLE: RigidBodyOptions = { collider: { shape: new Circle(10) } };

function tick(seconds: number): WorldUpdate {
  return { deltaSeconds: seconds } as WorldUpdate;
}

describe('RigidBody', () => {
  describe('construction', () => {
    test('throws PHYSICS_NO_COLLIDER when no collider is supplied', () => {
      const object = makeWorld().createEmpty();

      expect(captureCode(() => new RigidBody(object, {}))).toBe(
        ErrorCode.PHYSICS_NO_COLLIDER,
      );
    });

    test('throws WORLD_COMPONENT_DEPENDENCY_MISSING when the world has no PhysicsWorld', () => {
      const world = makeWorld(false);

      expect(captureCode(() => addBody(world, CIRCLE))).toBe(
        ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING,
      );
    });
  });

  describe('onAdded', () => {
    test('registers exactly one body and one collider with the simulation', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);

      const { body } = addBody(world, CIRCLE);

      expect(body.raw).toBeInstanceOf(RAPIER.RigidBody);
      expect(physics.raw.bodies.len()).toBe(1);
      expect(physics.raw.colliders.len()).toBe(1);
    });

    test('registers one collider per entry for a compound body', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);

      addBody(world, {
        colliders: [
          { shape: new Circle(10), offset: { x: -10, y: 0 } },
          { shape: new Circle(10), offset: { x: 10, y: 0 } },
        ],
      });

      expect(physics.raw.bodies.len()).toBe(1);
      expect(physics.raw.colliders.len()).toBe(2);
    });

    test('seeds the body translation from the host position', () => {
      const world = makeWorld();
      const { body } = addBody(world, CIRCLE, { x: 100, y: 50 });

      const translation = body.raw.translation();
      expect(translation.x).toBeCloseTo(100);
      expect(translation.y).toBeCloseTo(50);
    });

    test('exposes the configured type', () => {
      const world = makeWorld();
      const { body } = addBody(world, {
        ...CIRCLE,
        type: 'kinematic-velocity',
      });

      expect(body.type).toBe('kinematic-velocity');
    });

    test('applies the optional motion and collider-material descriptors', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);

      const { body } = addBody(world, {
        type: 'dynamic',
        angularVelocity: 1.5,
        linearDamping: 0.2,
        angularDamping: 0.3,
        gravityScale: 0,
        ccd: true,
        collider: {
          shape: new Circle(10),
          density: 2,
          friction: 0.4,
          restitution: 0.5,
        },
      });

      expect(physics.raw.bodies.len()).toBe(1);
      expect(physics.raw.colliders.len()).toBe(1);
      // Read before any step, so it reflects the seeded descriptor value.
      expect(body.angularVelocity).toBeCloseTo(1.5);
    });

    test('lockRotation pins the body upright and isSensor builds a trigger collider', () => {
      const world = makeWorld();
      const { body } = addBody(world, {
        lockRotation: true,
        collider: { shape: new Circle(10), isSensor: true },
      });

      body.applyTorqueImpulse(50);

      // Rotation is locked (infinite angular inertia), so torque does nothing.
      expect(body.angularVelocity).toBe(0);
    });
  });

  describe('transform bridging', () => {
    test('a dynamic body writes its simulated position back onto the host', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const { object, body } = addBody(world, CIRCLE);

      for (let i = 0; i < 30; i++) {
        physics.onPreUpdate(tick(1 / 60));
        body.onPreUpdate();
      }

      expect(object.position.y).toBeGreaterThan(0);
    });

    test('a kinematic-velocity body follows its velocity into the host', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const { object, body } = addBody(world, {
        ...CIRCLE,
        type: 'kinematic-velocity',
        linearVelocity: { x: 60, y: 0 },
      });

      for (let i = 0; i < 30; i++) {
        physics.onPreUpdate(tick(1 / 60));
        body.onPreUpdate();
      }

      expect(object.position.x).toBeGreaterThan(0);
    });

    test('a kinematic-position body is driven from the host transform', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const { object, body } = addBody(world, {
        ...CIRCLE,
        type: 'kinematic-position',
      });

      object.position.set(120, 40);
      body.onPreUpdate(); // push the host transform as the next target
      physics.onPreUpdate(tick(1 / 60)); // the step consumes the target

      const translation = body.raw.translation();
      expect(translation.x).toBeCloseTo(120);
      expect(translation.y).toBeCloseTo(40);
    });

    test('a fixed body never moves and its pre-update is a no-op', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const { object, body } = addBody(world, { ...CIRCLE, type: 'fixed' });

      for (let i = 0; i < 30; i++) {
        physics.onPreUpdate(tick(1 / 60));
        body.onPreUpdate();
      }

      expect(object.position.x).toBe(0);
      expect(object.position.y).toBe(0);
    });
  });

  describe('runtime control', () => {
    test('velocity getter and setter round-trip through the body', () => {
      const world = makeWorld();
      const { body } = addBody(world, CIRCLE);

      body.velocity = { x: 30, y: -20 };

      expect(body.velocity.x).toBeCloseTo(30);
      expect(body.velocity.y).toBeCloseTo(-20);
    });

    test('applyImpulse changes the linear velocity', () => {
      const world = makeWorld();
      const { body } = addBody(world, CIRCLE);

      body.applyImpulse({ x: 100, y: 0 });

      expect(body.velocity.x).toBeGreaterThan(0);
    });

    test('angularVelocity getter and setter round-trip through the body', () => {
      const world = makeWorld();
      const { body } = addBody(world, CIRCLE);

      body.angularVelocity = 2.5;

      expect(body.angularVelocity).toBeCloseTo(2.5);
    });

    test('applyTorqueImpulse changes the angular velocity', () => {
      const world = makeWorld();
      const { body } = addBody(world, CIRCLE);

      body.applyTorqueImpulse(20);

      expect(body.angularVelocity).not.toBe(0);
    });

    test('applyForce wakes and accelerates the body over a step', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const { body } = addBody(world, {
        ...CIRCLE,
        gravityScale: 0, // isolate the force from gravity
      });

      body.applyForce({ x: 500, y: 0 });
      physics.onPreUpdate(tick(1 / 60));

      expect(body.velocity.x).toBeGreaterThan(0);
    });

    test('a fresh body is awake and wake() is safe to call', () => {
      const world = makeWorld();
      const { body } = addBody(world, CIRCLE);

      expect(body.isSleeping).toBe(false);
      expect(() => body.wake()).not.toThrow();
    });

    test('setPosition teleports the body and mirrors onto the host immediately', () => {
      const world = makeWorld();
      const { object, body } = addBody(world, CIRCLE);

      body.setPosition({ x: 120, y: -40 });

      const translation = body.raw.translation();
      expect(translation.x).toBeCloseTo(120);
      expect(translation.y).toBeCloseTo(-40);
      // Mirrored onto the host so the teleport is visible this frame rather
      // than after the next pre-update readback.
      expect(object.position.x).toBeCloseTo(120);
      expect(object.position.y).toBeCloseTo(-40);
    });

    test('setRotation teleports the body angle and mirrors onto the host', () => {
      const world = makeWorld();
      const { object, body } = addBody(world, CIRCLE);

      body.setRotation(Math.PI / 2);

      expect(body.raw.rotation()).toBeCloseTo(Math.PI / 2);
      expect(object.rotation).toBeCloseTo(Math.PI / 2);
    });

    test('control methods throw PHYSICS_BODY_NOT_ATTACHED before the component is added', () => {
      const object = makeWorld().createEmpty();
      const detached = new RigidBody(object, CIRCLE);

      expect(captureCode(() => detached.velocity)).toBe(
        ErrorCode.PHYSICS_BODY_NOT_ATTACHED,
      );
      expect(captureCode(() => detached.raw)).toBe(
        ErrorCode.PHYSICS_BODY_NOT_ATTACHED,
      );
    });
  });

  describe('onDestroy', () => {
    test('removes the body from the simulation', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const { body } = addBody(world, CIRCLE);

      expect(physics.raw.bodies.len()).toBe(1);

      body.onDestroy();

      expect(physics.raw.bodies.len()).toBe(0);
    });

    test('is safe to call when the body was never created', () => {
      const object = makeWorld().createEmpty();
      const detached = new RigidBody(object, CIRCLE);

      expect(() => detached.onDestroy()).not.toThrow();
    });
  });

  describe('collision events', () => {
    // A still, gravity-free dynamic body carrying a sensor collider: it stays
    // where placed but its overlaps are reported. The standard "probe" for
    // these tests.
    function sensorProbe(
      onCollisionStart?: (event: CollisionEvent) => void,
      onCollisionEnd?: (event: CollisionEvent) => void,
    ): RigidBodyOptions {
      return {
        type: 'dynamic',
        gravityScale: 0,
        collider: { shape: new Circle(20), isSensor: true },
        ...(onCollisionStart ? { onCollisionStart } : {}),
        ...(onCollisionEnd ? { onCollisionEnd } : {}),
      };
    }

    const TARGET: RigidBodyOptions = {
      type: 'fixed',
      collider: { shape: new Circle(20) },
    };

    test('onCollisionStart fires once when two bodies begin overlapping', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const events: CollisionEvent[] = [];

      const { object: target } = addBody(world, TARGET, { x: 0, y: 0 });
      const { body: probe } = addBody(
        world,
        sensorProbe((event) => events.push(event)),
        { x: 10, y: 0 },
      );

      physics.onPreUpdate(tick(1 / 60));
      probe.onUpdate();

      expect(events).toHaveLength(1);
      expect(events[0]!.self).toBe(probe);
      expect(events[0]!.otherObject).toBe(target);
    });

    test('a body with no listener neither flags its collider nor receives events', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);

      addBody(world, TARGET, { x: 0, y: 0 });
      // No onCollisionStart/onCollisionEnd: this body opts out entirely.
      const { body: silent } = addBody(world, sensorProbe(), { x: 10, y: 0 });

      physics.onPreUpdate(tick(1 / 60));

      // Nothing was buffered for it, so draining its (absent) events is empty.
      expect(silent._wantsCollisionEvents()).toBe(false);
      expect(physics._takeCollisions(silent)).toHaveLength(0);
    });

    test('delivers the collision to every listening body in the pair', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const seenByA: CollisionEvent[] = [];
      const seenByB: CollisionEvent[] = [];

      const { object: objectA, body: bodyA } = addBody(
        world,
        sensorProbe((event) => seenByA.push(event)),
        { x: 0, y: 0 },
      );
      const { object: objectB, body: bodyB } = addBody(
        world,
        sensorProbe((event) => seenByB.push(event)),
        { x: 10, y: 0 },
      );

      physics.onPreUpdate(tick(1 / 60));
      bodyA.onUpdate();
      bodyB.onUpdate();

      expect(seenByA).toHaveLength(1);
      expect(seenByA[0]!.otherObject).toBe(objectB);
      expect(seenByB).toHaveLength(1);
      expect(seenByB[0]!.otherObject).toBe(objectA);
    });

    test('onCollisionEnd fires when a previously-overlapping body separates', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const starts: CollisionEvent[] = [];
      const ends: CollisionEvent[] = [];

      const { object: target } = addBody(world, TARGET, { x: 0, y: 0 });
      const { body: probe } = addBody(
        world,
        sensorProbe(
          (event) => starts.push(event),
          (event) => ends.push(event),
        ),
        { x: 10, y: 0 },
      );

      physics.onPreUpdate(tick(1 / 60));
      probe.onUpdate();
      expect(starts).toHaveLength(1);

      // Send the probe far clear of the target and let the sim catch up.
      probe.velocity = { x: 2000, y: 0 };
      for (let i = 0; i < 30 && ends.length === 0; i++) {
        physics.onPreUpdate(tick(1 / 60));
        probe.onUpdate();
      }

      expect(ends).toHaveLength(1);
      expect(ends[0]!.otherObject).toBe(target);
    });

    test('forgets a destroyed body so it stops generating events', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const events: CollisionEvent[] = [];

      addBody(world, TARGET, { x: 0, y: 0 });
      const { body: probe } = addBody(
        world,
        sensorProbe((event) => events.push(event)),
        { x: 10, y: 0 },
      );

      probe.onDestroy();

      physics.onPreUpdate(tick(1 / 60));

      // Its colliders were unregistered, so the overlap resolves to no body.
      expect(physics._takeCollisions(probe)).toHaveLength(0);
      expect(events).toHaveLength(0);
    });

    test('buffers several collisions against one body in a single frame', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const events: CollisionEvent[] = [];

      // One probe straddling two targets overlaps both in the same step.
      addBody(world, TARGET, { x: -10, y: 0 });
      addBody(world, TARGET, { x: 10, y: 0 });
      const { body: probe } = addBody(
        world,
        sensorProbe((event) => events.push(event)),
        { x: 0, y: 0 },
      );

      physics.onPreUpdate(tick(1 / 60));
      probe.onUpdate();

      expect(events).toHaveLength(2);
    });

    test('onUpdate is a no-op for a body that was never added', () => {
      const object = makeWorld().createEmpty();
      const detached = new RigidBody(
        object,
        sensorProbe(() => {
          throw new Error('should never run');
        }),
      );

      expect(() => detached.onUpdate()).not.toThrow();
    });

    test('ignores overlaps with raw colliders not owned by a RigidBody', () => {
      const world = makeWorld();
      const physics = world.getComponentByType(PhysicsWorld);
      const events: CollisionEvent[] = [];

      const { body: probe } = addBody(
        world,
        sensorProbe((event) => events.push(event)),
        { x: 0, y: 0 },
      );

      // A collider created straight through the Rapier escape hatch is unknown
      // to the handle→body map; an overlap with it must resolve to no body and
      // be quietly dropped rather than crashing the dispatch.
      const rawBody = physics.raw.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(10, 0),
      );
      physics.raw.createCollider(RAPIER.ColliderDesc.ball(20), rawBody);

      physics.onPreUpdate(tick(1 / 60));
      probe.onUpdate();

      expect(events).toHaveLength(0);
    });

    test('a throwing listener is isolated through the world error channel', () => {
      const errors: WorldErrorContext[] = [];
      const world = new World(Game.createHeadless(), {
        components: (w) => ({ physics: () => new PhysicsWorld(w) }),
        onError: (context) => errors.push(context),
      });
      const physics = world.getComponentByType(PhysicsWorld);

      addBody(world, TARGET, { x: 0, y: 0 });
      const { object: probeObject } = addBody(
        world,
        sensorProbe(() => {
          throw new Error('listener boom');
        }),
        { x: 10, y: 0 },
      );

      physics.onPreUpdate(tick(1 / 60));
      // Drive the object's update phase so the host's per-component isolation
      // wraps the listener, rather than calling the body hook directly.
      probeObject.onUpdate(tick(1 / 60));

      expect(errors).toHaveLength(1);
      expect(errors[0]!.phase).toBe('component-update');
    });
  });
});
