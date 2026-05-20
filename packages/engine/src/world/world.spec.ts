import { Component } from '../components';
import { EngineError, ErrorCode } from '../error';
import { Point } from '../geometry';
import { Prefab } from './prefab';
import { PrefabRegistry } from './prefab-registry';
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
    test('elapsedMilliseconds across consecutive ticks equals the sum of deltas', () => {
      const world = createWorld();

      const first = world.update();
      const second = world.update();
      const third = world.update();

      // The no-drift invariant restated against the public surface: no
      // wall-clock time is silently lost between ticks, so each frame's
      // elapsed clock equals the previous elapsed plus the current delta.
      expect(second.elapsedMilliseconds).toBe(
        first.elapsedMilliseconds + second.deltaMilliseconds,
      );
      expect(third.elapsedMilliseconds).toBe(
        second.elapsedMilliseconds + third.deltaMilliseconds,
      );
    });

    test('the first tick emits a zero delta and a zero elapsed time', () => {
      const world = createWorld();

      const first = world.update();

      // First tick has no prior timestamp to diff against; emitting a
      // since-epoch delta would teleport every moving entity on the
      // inaugural frame, so the engine deliberately reports 0.
      expect(first.deltaMilliseconds).toBe(0);
      expect(first.elapsedMilliseconds).toBe(0);
    });

    test('frameIndex increments by one on every tick, starting at zero', () => {
      const world = createWorld();

      expect(world.update().frameIndex).toBe(0);
      expect(world.update().frameIndex).toBe(1);
      expect(world.update().frameIndex).toBe(2);
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

  describe('prefab integration', () => {
    test('createFromPrefab adds the object to the world and exposes it via findById', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });
      const world = createWorld();

      const object = world.createFromPrefab(prefab);

      expect(world.findById(object.metadata.id)).toBe(object);
      expect(object.metadata.id).toBe('enemy@1');
      expect(object.metadata.prefabName).toBe('enemy');
    });

    test('createFromPrefabName resolves through the attached registry', () => {
      const enemy = new Prefab({ name: 'enemy', components: {} });
      const prefabs = new PrefabRegistry([enemy]);
      const world = new World({ components: () => ({}), prefabs });

      const object = world.createFromPrefabName('enemy');

      expect(object.metadata.prefabName).toBe('enemy');
      expect(world.findById(object.metadata.id)).toBe(object);
    });

    test('createFromPrefabName throws PREFAB_REGISTRY_NOT_ATTACHED with no registry', () => {
      const world = createWorld();

      let caught: unknown = null;
      try {
        world.createFromPrefabName('enemy');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(
        ErrorCode.PREFAB_REGISTRY_NOT_ATTACHED,
      );
    });

    test('createFromPrefabName surfaces PREFAB_NOT_FOUND from the registry', () => {
      const prefabs = new PrefabRegistry();
      const world = new World({ components: () => ({}), prefabs });

      let caught: unknown = null;
      try {
        world.createFromPrefabName('ghost');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(ErrorCode.PREFAB_NOT_FOUND);
    });

    test('world.prefabs exposes the attached registry, or null', () => {
      const prefabs = new PrefabRegistry();
      const withRegistry = new World({ components: () => ({}), prefabs });
      const withoutRegistry = createWorld();

      expect(withRegistry.prefabs).toBe(prefabs);
      expect(withoutRegistry.prefabs).toBeNull();
    });

    test('the same registry can be shared across multiple worlds', () => {
      const prefab = new Prefab({ name: 'shared', components: {} });
      const prefabs = new PrefabRegistry([prefab]);

      const worldA = new World({ components: () => ({}), prefabs });
      const worldB = new World({ components: () => ({}), prefabs });

      const a = worldA.createFromPrefabName('shared');
      const b = worldB.createFromPrefabName('shared');

      // Same prefab object → continuous, monotonically-increasing id stream.
      expect(a.metadata.id).toBe('shared@1');
      expect(b.metadata.id).toBe('shared@2');
    });
  });

  describe('three-phase update', () => {
    type PhaseEvent = {
      readonly source: string;
      readonly phase: 'pre' | 'update' | 'post';
    };

    const attachPhaseRecorder = (
      object: WorldObject,
      source: string,
      events: PhaseEvent[],
      key = 'phases',
    ) => {
      const component: Component<WorldObject> = {
        host: object,
        onAdded: () => {},
        onPreUpdate: () => {
          events.push({ source, phase: 'pre' });
        },
        onUpdate: () => {
          events.push({ source, phase: 'update' });
        },
        onPostUpdate: () => {
          events.push({ source, phase: 'post' });
        },
        onDestroy: () => {},
      };

      object.addComponent(key, component);
    };

    test('all components fire onPreUpdate before any onUpdate, and all onUpdate before any onPostUpdate', () => {
      const events: PhaseEvent[] = [];
      const world: World = new World({
        components: (w) => ({
          worldA: () => ({
            host: w,
            onAdded: () => {},
            onPreUpdate: () => events.push({ source: 'worldA', phase: 'pre' }),
            onUpdate: () => events.push({ source: 'worldA', phase: 'update' }),
            onPostUpdate: () =>
              events.push({ source: 'worldA', phase: 'post' }),
            onDestroy: () => {},
          }),
        }),
      });
      const objectA = world.createEmpty();
      const objectB = world.createEmpty();
      attachPhaseRecorder(objectA, 'objectA', events);
      attachPhaseRecorder(objectB, 'objectB', events);

      world.update();

      const phases = events.map((e) => e.phase);
      const lastPre = phases.lastIndexOf('pre');
      const firstUpdate = phases.indexOf('update');
      const lastUpdate = phases.lastIndexOf('update');
      const firstPost = phases.indexOf('post');

      expect(lastPre).toBeLessThan(firstUpdate);
      expect(lastUpdate).toBeLessThan(firstPost);
    });

    test('within a phase, world components fire before object components', () => {
      const events: PhaseEvent[] = [];
      const world: World = new World({
        components: (w) => ({
          worldThing: () => ({
            host: w,
            onAdded: () => {},
            onPreUpdate: () => events.push({ source: 'world', phase: 'pre' }),
            onUpdate: () => events.push({ source: 'world', phase: 'update' }),
            onPostUpdate: () =>
              events.push({ source: 'world', phase: 'post' }),
            onDestroy: () => {},
          }),
        }),
      });
      const object = world.createEmpty();
      attachPhaseRecorder(object, 'object', events);

      world.update();

      // For each phase, the world entry should precede the object entry.
      for (const phase of ['pre', 'update', 'post'] as const) {
        const worldIdx = events.findIndex(
          (e) => e.source === 'world' && e.phase === phase,
        );
        const objectIdx = events.findIndex(
          (e) => e.source === 'object' && e.phase === phase,
        );
        expect(worldIdx).toBeGreaterThanOrEqual(0);
        expect(objectIdx).toBeGreaterThanOrEqual(0);
        expect(worldIdx).toBeLessThan(objectIdx);
      }
    });

    test('components without onPreUpdate or onPostUpdate are skipped silently', () => {
      const world = createWorld();
      const object = world.createEmpty();

      let updates = 0;
      const component: Component<WorldObject> = {
        host: object,
        onAdded: () => {},
        onUpdate: () => {
          updates++;
        },
        onDestroy: () => {},
      };
      object.addComponent('only-update', component);

      // No optional hooks present — the world tick should not throw.
      expect(() => world.update()).not.toThrow();
      expect(updates).toBe(1);
    });

    test('a destroyed object skips its remaining phases this tick', () => {
      const events: PhaseEvent[] = [];
      const world = createWorld();
      const object = world.createEmpty();

      // Self-destruct during onPreUpdate. onUpdate and onPostUpdate for this
      // object should not fire this tick.
      const component: Component<WorldObject> = {
        host: object,
        onAdded: () => {},
        onPreUpdate: () => {
          events.push({ source: 'object', phase: 'pre' });
          object.destroy();
        },
        onUpdate: () => {
          events.push({ source: 'object', phase: 'update' });
        },
        onPostUpdate: () => {
          events.push({ source: 'object', phase: 'post' });
        },
        onDestroy: () => {},
      };
      object.addComponent('self-destruct', component);

      world.update();

      expect(events).toEqual([{ source: 'object', phase: 'pre' }]);
    });

    test('a component destroyed mid-tick still gets onDestroy called once', () => {
      const world = createWorld();
      const object = world.createEmpty();
      const spy = attachSpy(object);

      object.destroy();
      world.update();

      expect(spy.destroys).toBe(1);
    });
  });

  describe('enabled flag', () => {
    test('skips all three update phases when enabled is false', () => {
      const world = createWorld();
      const object = world.createEmpty();

      let preCount = 0;
      let updateCount = 0;
      let postCount = 0;

      const component: Component<WorldObject> = {
        host: object,
        enabled: false,
        onAdded: () => {},
        onPreUpdate: () => {
          preCount++;
        },
        onUpdate: () => {
          updateCount++;
        },
        onPostUpdate: () => {
          postCount++;
        },
        onDestroy: () => {},
      };
      object.addComponent('off', component);

      world.update();
      world.update();

      expect(preCount).toBe(0);
      expect(updateCount).toBe(0);
      expect(postCount).toBe(0);
    });

    test('still fires onAdded and onDestroy when enabled is false', () => {
      const world = createWorld();
      const object = world.createEmpty();

      let addedCount = 0;
      let destroyCount = 0;

      const component: Component<WorldObject> = {
        host: object,
        enabled: false,
        onAdded: () => {
          addedCount++;
        },
        onUpdate: () => {},
        onDestroy: () => {
          destroyCount++;
        },
      };

      object.addComponent('off', component);
      expect(addedCount).toBe(1);

      object.destroy();
      world.update();
      expect(destroyCount).toBe(1);
    });

    test('flipping enabled back to true re-engages the component', () => {
      const world = createWorld();
      const object = world.createEmpty();

      let updates = 0;
      const component: Component<WorldObject> = {
        host: object,
        enabled: false,
        onAdded: () => {},
        onUpdate: () => {
          updates++;
        },
        onDestroy: () => {},
      };
      object.addComponent('toggle', component);

      world.update();
      expect(updates).toBe(0);

      component.enabled = true;
      world.update();
      expect(updates).toBe(1);
    });

    test('absent enabled treated as enabled (default)', () => {
      const world = createWorld();
      const object = world.createEmpty();
      const spy = attachSpy(object); // attachSpy doesn't set enabled.

      world.update();

      expect(spy.updates).toBe(1);
    });

    test('also applies to world-scoped components', () => {
      let updates = 0;
      const world: World = new World({
        components: (w) => ({
          off: () => ({
            host: w,
            enabled: false,
            onAdded: () => {},
            onUpdate: () => {
              updates++;
            },
            onDestroy: () => {},
          }),
        }),
      });

      world.update();

      expect(updates).toBe(0);
    });
  });

  describe('per-phase error reporting', () => {
    test('errors from each phase are tagged with the matching error phase', () => {
      const errors: WorldErrorContext[] = [];
      const world = new World({
        components: () => ({}),
        onError: (ctx) => errors.push(ctx),
      });
      const object = world.createEmpty();

      const component: Component<WorldObject> = {
        host: object,
        onAdded: () => {},
        onPreUpdate: () => {
          throw new Error('pre');
        },
        onUpdate: () => {
          throw new Error('update');
        },
        onPostUpdate: () => {
          throw new Error('post');
        },
        onDestroy: () => {},
      };
      object.addComponent('boom', component);

      world.update();

      const phases = errors.map((e) => e.phase);
      expect(phases).toEqual([
        'component-pre-update',
        'component-update',
        'component-post-update',
      ]);
    });

    test('a throwing pre-update does not prevent the same component from running onUpdate', () => {
      const errors: WorldErrorContext[] = [];
      let updateRan = false;

      const world = new World({
        components: () => ({}),
        onError: (ctx) => errors.push(ctx),
      });
      const object = world.createEmpty();

      const component: Component<WorldObject> = {
        host: object,
        onAdded: () => {},
        onPreUpdate: () => {
          throw new Error('pre');
        },
        onUpdate: () => {
          updateRan = true;
        },
        onDestroy: () => {},
      };
      object.addComponent('partial', component);

      world.update();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.phase).toBe('component-pre-update');
      expect(updateRan).toBe(true);
    });
  });

  describe('host-level enabled (WorldObject)', () => {
    test('defaults to true', () => {
      const world = createWorld();
      const object = world.createEmpty();

      expect(object.enabled).toBe(true);
    });

    test('skips all three update phases on the object when false', () => {
      const world = createWorld();
      const object = world.createEmpty();

      let preCount = 0;
      let updateCount = 0;
      let postCount = 0;

      object.addComponent('spy', {
        host: object,
        onAdded: () => {},
        onPreUpdate: () => {
          preCount++;
        },
        onUpdate: () => {
          updateCount++;
        },
        onPostUpdate: () => {
          postCount++;
        },
        onDestroy: () => {},
      });

      object.enabled = false;

      world.update();
      world.update();

      expect(preCount).toBe(0);
      expect(updateCount).toBe(0);
      expect(postCount).toBe(0);
    });

    test('does not gate onAdded or onDestroy when disabled', () => {
      const world = createWorld();
      const object = world.createEmpty();
      object.enabled = false;

      let added = 0;
      let destroyed = 0;

      object.addComponent('hook', {
        host: object,
        onAdded: () => {
          added++;
        },
        onUpdate: () => {},
        onDestroy: () => {
          destroyed++;
        },
      });

      expect(added).toBe(1);

      object.destroy();
      world.update();

      expect(destroyed).toBe(1);
    });

    test('flipping enabled back to true resumes ticking with preserved state', () => {
      const world = createWorld();
      const object = world.createEmpty();

      let updates = 0;
      object.addComponent('spy', {
        host: object,
        onAdded: () => {},
        onUpdate: () => {
          updates++;
        },
        onDestroy: () => {},
      });

      object.enabled = false;
      world.update();
      expect(updates).toBe(0);

      object.enabled = true;
      world.update();
      world.update();

      expect(updates).toBe(2);
    });

    test('a disabled object does not block other objects from ticking', () => {
      const world = createWorld();
      const frozen = world.createEmpty();
      const live = world.createEmpty();

      const frozenSpy = attachSpy(frozen);
      const liveSpy = attachSpy(live);

      frozen.enabled = false;
      world.update();

      expect(frozenSpy.updates).toBe(0);
      expect(liveSpy.updates).toBe(1);
    });
  });

  describe('host-level enabled (World)', () => {
    test('defaults to true', () => {
      const world = createWorld();

      expect(world.enabled).toBe(true);
    });

    test('skips world-scoped component phases when false', () => {
      let worldUpdates = 0;
      const world = new World({
        components: (w) => ({
          system: () => ({
            host: w,
            onAdded: () => {},
            onUpdate: () => {
              worldUpdates++;
            },
            onDestroy: () => {},
          }),
        }),
      });

      world.enabled = false;
      world.update();
      world.update();

      expect(worldUpdates).toBe(0);
    });

    test('does not gate per-object iteration when false (use !update() for that)', () => {
      const world = createWorld();
      const object = world.createEmpty();
      const spy = attachSpy(object);

      world.enabled = false;
      world.update();

      // Objects keep ticking — world.enabled gates the world's *own*
      // components, not the object-iteration pass.
      expect(spy.updates).toBe(1);
    });
  });

  describe('WorldObject transform fields', () => {
    test('rotation defaults to 0 and is mutable', () => {
      const world = createWorld();
      const object = world.createEmpty();

      expect(object.rotation).toBe(0);

      object.rotation = Math.PI / 2;
      expect(object.rotation).toBe(Math.PI / 2);
    });

    test('scale defaults to 1,1 and exposes a mutable Point', () => {
      const world = createWorld();
      const object = world.createEmpty();

      expect(object.scale.x).toBe(1);
      expect(object.scale.y).toBe(1);

      object.scale.x = 2;
      object.scale.y = 3;

      expect(object.scale.x).toBe(2);
      expect(object.scale.y).toBe(3);
    });

    test('constructor accepts custom rotation and scale', () => {
      const world = createWorld();
      const object = new WorldObject(
        world,
        Point.zero(),
        { id: 'manual', tags: new Set() },
        Math.PI,
        new Point(2, 0.5),
      );

      expect(object.rotation).toBe(Math.PI);
      expect(object.scale.x).toBe(2);
      expect(object.scale.y).toBe(0.5);
    });

    test('scale is cloned from the constructor input (no aliasing)', () => {
      const world = createWorld();
      const sharedScale = new Point(2, 2);
      const object = new WorldObject(
        world,
        Point.zero(),
        { id: 'manual', tags: new Set() },
        0,
        sharedScale,
      );

      sharedScale.x = 99;

      expect(object.scale.x).toBe(2);
    });
  });
});
