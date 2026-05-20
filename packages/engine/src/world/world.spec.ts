import { Component } from '../components';
import { World, WorldErrorContext } from './world';
import { WorldObject } from './world-object';

type Spy = {
  updates: number;
  destroys: number;
};

const createWorld = () => new World({ components: () => ({}) });

const attachSpy = (object: WorldObject, key = 'spy'): Spy => {
  const spy: Spy = { updates: 0, destroys: 0 };
  const component: Component<WorldObject> = {
    host: object,
    onAdded: () => {},
    onUpdate: () => {
      spy.updates++;
    },
    onDestroy: () => {
      spy.destroys++;
    },
  };

  object.addComponent(key, component);

  return spy;
};

const attachHook = (
  object: WorldObject,
  hooks: Partial<Pick<Component<WorldObject>, 'onUpdate' | 'onDestroy'>>,
  key = 'hook',
): void => {
  const component: Component<WorldObject> = {
    host: object,
    onAdded: () => {},
    onUpdate: hooks.onUpdate ?? (() => {}),
    onDestroy: hooks.onDestroy ?? (() => {}),
  };

  object.addComponent(key, component);
};

describe('World', () => {
  describe('setup-time spawning', () => {
    test('objects created before the first tick are iterated on that tick', () => {
      const world = createWorld();
      const object = world.createEmpty();
      const spy = attachSpy(object);

      world.update();

      expect(spy.updates).toBe(1);
    });
  });

  describe('deferred destroy', () => {
    test('an object destroyed during its own update is removed at the end of the tick', () => {
      const world = createWorld();
      const object = world.createEmpty();
      const spy = attachSpy(object);
      attachHook(object, { onUpdate: () => object.destroy() });

      world.update();

      expect(spy.updates).toBe(1);
      expect(spy.destroys).toBe(1);
      expect(world.findById(object.metadata.id)).toBeNull();
    });

    test('an object destroyed by an earlier object in the same tick has its onUpdate skipped', () => {
      const world = createWorld();
      const killer = world.createEmpty();
      const victim = world.createEmpty();
      const victimSpy = attachSpy(victim);

      attachHook(killer, { onUpdate: () => victim.destroy() });

      world.update();

      expect(victimSpy.updates).toBe(0);
      expect(victimSpy.destroys).toBe(1);
      expect(world.findById(victim.metadata.id)).toBeNull();
    });

    test('an object destroyed during the component phase has its onUpdate skipped', () => {
      let victim: WorldObject | null = null;
      const world = new World({
        components: (world) => ({
          killer: () => ({
            host: world,
            onAdded: () => {},
            onUpdate: () => {
              victim?.destroy();
            },
            onDestroy: () => {},
          }),
        }),
      });

      victim = world.createEmpty();
      const victimSpy = attachSpy(victim);

      world.update();

      expect(victimSpy.updates).toBe(0);
      expect(victimSpy.destroys).toBe(1);
      expect(world.findById(victim.metadata.id)).toBeNull();
    });

    test('a mass self-destruction tick removes every object without skipping any', () => {
      const world = createWorld();
      const objects = Array.from({ length: 10 }, () => world.createEmpty());
      const spies = objects.map((o) => attachSpy(o));

      objects.forEach((o) => attachHook(o, { onUpdate: () => o.destroy() }));

      world.update();

      spies.forEach((spy) => {
        expect(spy.updates).toBe(1);
        expect(spy.destroys).toBe(1);
      });
      objects.forEach((o) => {
        expect(world.findById(o.metadata.id)).toBeNull();
      });
    });

    test('onDestroy that destroys an earlier-iterated object defers that second destruction to the next tick', () => {
      const world = createWorld();
      // Creation order is iteration order. Put b first so that when the
      // sweep iterates [b, a], b is checked-and-skipped before a's onDestroy
      // has had a chance to mark it. This is the case where the safety
      // contract actually matters — without the explicit sweep-set we built
      // in world.ts, b would be silently dropped on this tick without ever
      // receiving its own onDestroy.
      const b = world.createEmpty();
      const a = world.createEmpty();
      const bSpy = attachSpy(b);

      attachHook(a, {
        onUpdate: () => a.destroy(),
        onDestroy: () => b.destroy(),
      });

      world.update();

      expect(bSpy.destroys).toBe(0);
      expect(b.destroyed).toBe(true);
      expect(world.findById(a.metadata.id)).toBeNull();
      expect(world.findById(b.metadata.id)).toBe(b);

      world.update();

      expect(bSpy.destroys).toBe(1);
      expect(world.findById(b.metadata.id)).toBeNull();
    });
  });

  describe('deferred spawn', () => {
    test('an object spawned during another object\'s update does not get onUpdate that tick', () => {
      const world = createWorld();
      const spawner = world.createEmpty();
      let spawned: WorldObject | null = null;
      let spawnedSpy: Spy | null = null;

      attachHook(spawner, {
        onUpdate: () => {
          if (!spawned) {
            spawned = world.createEmpty();
            spawnedSpy = attachSpy(spawned);
          }
        },
      });

      world.update();

      expect(spawnedSpy!.updates).toBe(0);
      expect(world.findById(spawned!.metadata.id)).toBe(spawned);

      world.update();

      expect(spawnedSpy!.updates).toBe(1);
    });

    test('an object spawned during the component phase does not get onUpdate that tick', () => {
      let spawned: WorldObject | null = null;
      let spawnedSpy: Spy | null = null;
      const world = new World({
        components: (world) => ({
          spawner: () => ({
            host: world,
            onAdded: () => {},
            onUpdate: () => {
              if (!spawned) {
                spawned = world.createEmpty();
                spawnedSpy = attachSpy(spawned);
              }
            },
            onDestroy: () => {},
          }),
        }),
      });

      world.update();

      expect(spawnedSpy!.updates).toBe(0);
      expect(world.findById(spawned!.metadata.id)).toBe(spawned);

      world.update();

      expect(spawnedSpy!.updates).toBe(1);
    });

    test('a spawned object is findable via findById in the same tick it was spawned', () => {
      const world = createWorld();
      const spawner = world.createEmpty();
      let observed: WorldObject | null = null;

      attachHook(spawner, {
        onUpdate: () => {
          if (!observed) {
            const spawned = world.createEmpty();
            // The spawned object should be retrievable mid-tick.
            observed = world.findById(spawned.metadata.id);
          }
        },
      });

      world.update();

      expect(observed).not.toBeNull();
    });

    test('an object spawned and destroyed in the same tick never gets onUpdate but still gets onDestroy', () => {
      const world = createWorld();
      const spawner = world.createEmpty();
      let spawned: WorldObject | null = null;
      let spawnedSpy: Spy | null = null;

      attachHook(spawner, {
        onUpdate: () => {
          if (!spawned) {
            spawned = world.createEmpty();
            spawnedSpy = attachSpy(spawned);
            spawned.destroy();
          }
        },
      });

      world.update();

      expect(spawnedSpy!.updates).toBe(0);
      expect(spawnedSpy!.destroys).toBe(1);
      expect(world.findById(spawned!.metadata.id)).toBeNull();

      // Confirm it stays gone on subsequent ticks.
      world.update();
      expect(spawnedSpy!.updates).toBe(0);
    });
  });

  describe('World.destroy()', () => {
    test('invokes onDestroy on a marked-but-not-swept object exactly once', () => {
      const world = createWorld();
      const object = world.createEmpty();
      const spy = attachSpy(object);

      // Flag destroyed but never tick the world, so the sweep never gets a
      // chance to fire onDestroy. World.destroy() must still clean it up.
      object.destroy();
      world.destroy();

      expect(spy.destroys).toBe(1);
    });

    test('WorldObject.onDestroy is idempotent across repeat invocations', () => {
      const world = createWorld();
      const object = world.createEmpty();
      const spy = attachSpy(object);

      object.onDestroy();
      object.onDestroy();
      object.onDestroy();

      expect(spy.destroys).toBe(1);
    });

    test('object.destroyed is true after World.destroy(), even if destroy() was never called on the object', () => {
      const world = createWorld();
      const object = world.createEmpty();

      expect(object.destroyed).toBe(false);

      world.destroy();

      expect(object.destroyed).toBe(true);
    });
  });

  describe('error isolation (Unity-style resilience)', () => {
    test('a thrown world-component onUpdate is reported and does not abort the tick', () => {
      const errors: WorldErrorContext[] = [];
      let goodRan = false;
      const world = new World({
        components: (world) => ({
          bad: () => ({
            host: world,
            onAdded: () => {},
            onUpdate: () => {
              throw new Error('boom');
            },
            onDestroy: () => {},
          }),
          good: () => ({
            host: world,
            onAdded: () => {},
            onUpdate: () => {
              goodRan = true;
            },
            onDestroy: () => {},
          }),
        }),
        onError: (context) => errors.push(context),
      });

      world.update();

      expect(goodRan).toBe(true);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.phase).toBe('component-update');
      expect(errors[0]!.host).toBe(world);
      expect(errors[0]!.componentKey).toBe('bad');
      expect((errors[0]!.error as Error).message).toBe('boom');
    });

    test('a thrown object-component onUpdate isolates per-component on the same object', () => {
      const errors: WorldErrorContext[] = [];
      const world = new World({
        components: () => ({}),
        onError: (context) => errors.push(context),
      });
      const object = world.createEmpty();
      const goodSpy = attachSpy(object, 'good');
      attachHook(
        object,
        {
          onUpdate: () => {
            throw new Error('component-fail');
          },
        },
        'bad',
      );

      world.update();

      // The "good" spy still received its onUpdate this tick even though a
      // sibling threw.
      expect(goodSpy.updates).toBe(1);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.phase).toBe('component-update');
      expect(errors[0]!.host).toBe(object);
      expect(errors[0]!.componentKey).toBe('bad');
    });

    test('a thrown component onUpdate on one object does not stop the next object from updating', () => {
      const errors: WorldErrorContext[] = [];
      const world = new World({
        components: () => ({}),
        onError: (context) => errors.push(context),
      });
      const flaky = world.createEmpty();
      const healthy = world.createEmpty();
      attachHook(flaky, {
        onUpdate: () => {
          throw new Error('boom');
        },
      });
      const healthySpy = attachSpy(healthy);

      world.update();

      expect(healthySpy.updates).toBe(1);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.host).toBe(flaky);
    });

    test('a thrown component onDestroy isolates per-component and the host still cleans up', () => {
      const errors: WorldErrorContext[] = [];
      const world = new World({
        components: () => ({}),
        onError: (context) => errors.push(context),
      });
      const object = world.createEmpty();
      const goodSpy = attachSpy(object, 'good');
      attachHook(
        object,
        {
          onDestroy: () => {
            throw new Error('destroy-fail');
          },
        },
        'bad',
      );

      object.destroy();
      world.update();

      expect(goodSpy.destroys).toBe(1);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.phase).toBe('component-destroy');
      expect(errors[0]!.host).toBe(object);
      expect(errors[0]!.componentKey).toBe('bad');
      expect(world.findById(object.metadata.id)).toBeNull();
    });

    test('a thrown component onDestroy during World.destroy() is reported and other components still clean up', () => {
      const errors: WorldErrorContext[] = [];
      const world = new World({
        components: () => ({}),
        onError: (context) => errors.push(context),
      });
      const object = world.createEmpty();
      const goodSpy = attachSpy(object, 'good');
      attachHook(
        object,
        {
          onDestroy: () => {
            throw new Error('teardown-fail');
          },
        },
        'bad',
      );

      world.destroy();

      expect(goodSpy.destroys).toBe(1);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.phase).toBe('component-destroy');
    });

    test('the default handler falls back to console.error and the tick still completes', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        const world = new World({ components: () => ({}) });
        const object = world.createEmpty();
        const spy = attachSpy(object, 'good');
        attachHook(
          object,
          {
            onUpdate: () => {
              throw new Error('boom');
            },
          },
          'bad',
        );

        world.update();

        expect(spy.updates).toBe(1);
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    test('a throwing onError handler is the documented opt-in to fail-fast', () => {
      const world = new World({
        components: () => ({}),
        onError: (context) => {
          throw context.error;
        },
      });
      const object = world.createEmpty();
      attachHook(object, {
        onUpdate: () => {
          throw new Error('boom');
        },
      });

      expect(() => world.update()).toThrow('boom');

      // _isUpdating must still have been reset by the finally — the next
      // spawn should land directly in the live set.
      const next = world.createEmpty();
      const nextSpy = attachSpy(next, 'good');

      // Replace the throwing component so the next tick can complete.
      object.destroy();

      // The next update should propagate again because the first object's
      // onUpdate still throws. Skip past it by ticking once with the throw
      // (which now sweeps the destroyed object) and confirm the loop heals.
      expect(() => world.update()).not.toThrow();
      expect(nextSpy.updates).toBe(1);
    });
  });

  describe('tag queries', () => {
    test('findByTag and findOneByTag see objects spawned during the current tick', () => {
      const world = createWorld();
      const spawner = world.createEmpty();
      let matchedAll: readonly WorldObject[] = [];
      let matchedOne: WorldObject | null = null;

      attachHook(spawner, {
        onUpdate: () => {
          if (matchedAll.length === 0) {
            world.createEmpty(undefined, ['enemy']);
            matchedAll = world.findByTag('enemy');
            matchedOne = world.findOneByTag('enemy');
          }
        },
      });

      world.update();

      expect(matchedAll).toHaveLength(1);
      expect(matchedOne).not.toBeNull();
    });

    test('tag queries do not return a spawned-then-destroyed object after the sweep', () => {
      const world = createWorld();
      const spawner = world.createEmpty();

      attachHook(spawner, {
        onUpdate: () => {
          const o = world.createEmpty(undefined, ['enemy']);
          o.destroy();
        },
      });

      world.update();

      expect(world.findByTag('enemy')).toHaveLength(0);
      expect(world.findOneByTag('enemy')).toBeNull();
    });
  });

  describe('timing', () => {
    test('a frame uses a single now value for both Update.current and the stored previous timestamp', () => {
      const world = createWorld();

      const first = world.update();
      const second = world.update();

      // The second frame's `previous` should be exactly the first frame's
      // `current`, with no drift from intra-frame Date.now() drift.
      expect(second.previous).toBe(first.current);
    });

    test('calls onDestroy on pending objects that have not been flushed yet', () => {
      const world = createWorld();
      const spawner = world.createEmpty();
      let spawned: WorldObject | null = null;
      let spawnedSpy: Spy | null = null;

      attachHook(spawner, {
        onUpdate: () => {
          if (!spawned) {
            spawned = world.createEmpty();
            spawnedSpy = attachSpy(spawned);
            // Tearing the world down mid-tick is unusual but we still want
            // pending objects to receive a proper onDestroy.
            world.destroy();
          }
        },
      });

      world.update();

      expect(spawnedSpy!.destroys).toBe(1);
    });
  });
});
