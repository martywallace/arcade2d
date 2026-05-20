import { Component } from '../components';
import { EngineError, ErrorCode } from '../error';
import { Game } from '../game';
import { Point } from '../geometry';
import { PREFAB_BUILD_TOKEN } from './internal';
import { Prefab } from './prefab';
import { World } from './world';
import { WorldObject } from './world-object';

type ComponentSpy = {
  added: number;
  receivedWorld: World | null;
  receivedObject: WorldObject | null;
};

const makeComponent = (
  host: WorldObject,
  spy: ComponentSpy,
  context: { world: World; object: WorldObject },
): Component<WorldObject> => {
  spy.receivedWorld = context.world;
  spy.receivedObject = context.object;

  return {
    host,
    onAdded: () => {
      spy.added++;
    },
    onUpdate: () => {},
    onDestroy: () => {},
  };
};

const createWorld = () => new World(Game.createHeadless(),{ components: () => ({}) });

describe('Prefab', () => {
  describe('construction', () => {
    test('exposes its name and tags', () => {
      const prefab = new Prefab({
        name: 'enemy',
        tags: ['hostile', 'flying'],
        components: {},
      });

      expect(prefab.name).toBe('enemy');
      expect(prefab.tags).toEqual(['hostile', 'flying']);
    });

    test('defaults tags to an empty array when omitted', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });

      expect(prefab.tags).toEqual([]);
    });

    test('rejects an empty name', () => {
      let caught: unknown = null;

      try {
        new Prefab({ name: '', components: {} });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(ErrorCode.PREFAB_INVALID_NAME);
    });

    test('rejects a whitespace-only name', () => {
      expect(() => new Prefab({ name: '   ', components: {} })).toThrow(
        EngineError,
      );
    });

    test('spawnCount starts at 0', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });

      expect(prefab.spawnCount).toBe(0);
    });
  });

  describe('buildObject() authorisation', () => {
    test('throws PREFAB_BUILD_UNAUTHORIZED when called without the engine token', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });
      const world = createWorld();

      let caught: unknown = null;

      try {
        // Cast through unknown to deliberately bypass the type-level barrier;
        // we want to prove the runtime check still rejects.
        (
          prefab.buildObject as unknown as (
            token: unknown,
            world: World,
          ) => WorldObject
        )(Symbol('not-the-real-token'), world);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(
        ErrorCode.PREFAB_BUILD_UNAUTHORIZED,
      );
    });

    test('accepts the engine token and produces an object', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });
      const world = createWorld();

      const object = prefab.buildObject(PREFAB_BUILD_TOKEN, world);

      expect(object).toBeInstanceOf(WorldObject);
      expect(object.metadata.prefabName).toBe('enemy');
    });
  });

  describe('id minting', () => {
    test('issues prefab-prefixed ids without random suffixes', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });
      const world = createWorld();

      const a = prefab.buildObject(PREFAB_BUILD_TOKEN, world);
      const b = prefab.buildObject(PREFAB_BUILD_TOKEN, world);

      expect(a.metadata.id).toBe('enemy@1');
      expect(b.metadata.id).toBe('enemy@2');
    });

    test('spawnCount advances per buildObject() call', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });
      const world = createWorld();

      prefab.buildObject(PREFAB_BUILD_TOKEN, world);
      prefab.buildObject(PREFAB_BUILD_TOKEN, world);
      prefab.buildObject(PREFAB_BUILD_TOKEN, world);

      expect(prefab.spawnCount).toBe(3);
    });
  });

  describe('component graph', () => {
    test('invokes each factory exactly once per build, with shared context', () => {
      const spyA: ComponentSpy = {
        added: 0,
        receivedWorld: null,
        receivedObject: null,
      };
      const spyB: ComponentSpy = {
        added: 0,
        receivedWorld: null,
        receivedObject: null,
      };

      const prefab = new Prefab({
        name: 'enemy',
        components: {
          a: (ctx) => makeComponent(ctx.object, spyA, ctx),
          b: (ctx) => makeComponent(ctx.object, spyB, ctx),
        },
      });
      const world = createWorld();

      const object = prefab.buildObject(PREFAB_BUILD_TOKEN, world);

      expect(spyA.receivedWorld).toBe(world);
      expect(spyA.receivedObject).toBe(object);
      expect(spyB.receivedWorld).toBe(world);
      expect(spyB.receivedObject).toBe(object);
      expect(object.hasComponent('a')).toBe(true);
      expect(object.hasComponent('b')).toBe(true);
    });

    test('fires onAdded on every component (batched registration)', () => {
      const spy: ComponentSpy = {
        added: 0,
        receivedWorld: null,
        receivedObject: null,
      };

      const prefab = new Prefab({
        name: 'enemy',
        components: {
          only: (ctx) => makeComponent(ctx.object, spy, ctx),
        },
      });
      const world = createWorld();

      prefab.buildObject(PREFAB_BUILD_TOKEN, world);

      expect(spy.added).toBe(1);
    });

    test('produces independent component instances per build', () => {
      const seen: Component<WorldObject>[] = [];

      const prefab = new Prefab({
        name: 'enemy',
        components: {
          only: ({ object }) => {
            const component: Component<WorldObject> = {
              host: object,
              onAdded: () => {},
              onUpdate: () => {},
              onDestroy: () => {},
            };
            seen.push(component);
            return component;
          },
        },
      });
      const world = createWorld();

      prefab.buildObject(PREFAB_BUILD_TOKEN, world);
      prefab.buildObject(PREFAB_BUILD_TOKEN, world);

      expect(seen).toHaveLength(2);
      expect(seen[0]).not.toBe(seen[1]);
    });

    test('lets sibling factories reference each other inside onAdded', () => {
      let aSawB = false;

      const prefab = new Prefab({
        name: 'enemy',
        components: {
          a: ({ object }) => ({
            host: object,
            onAdded: () => {
              aSawB = object.hasComponent('b');
            },
            onUpdate: () => {},
            onDestroy: () => {},
          }),
          b: ({ object }) => ({
            host: object,
            onAdded: () => {},
            onUpdate: () => {},
            onDestroy: () => {},
          }),
        },
      });

      prefab.buildObject(PREFAB_BUILD_TOKEN, createWorld());

      expect(aSawB).toBe(true);
    });
  });

  describe('metadata', () => {
    test('copies tags into a fresh Set per spawn', () => {
      const prefab = new Prefab({
        name: 'enemy',
        tags: ['hostile'],
        components: {},
      });
      const world = createWorld();

      const a = prefab.buildObject(PREFAB_BUILD_TOKEN, world);
      const b = prefab.buildObject(PREFAB_BUILD_TOKEN, world);

      expect(a.metadata.tags).not.toBe(b.metadata.tags);
      expect(a.metadata.tags.has('hostile')).toBe(true);
      expect(b.metadata.tags.has('hostile')).toBe(true);

      a.metadata.tags.add('special');

      expect(b.metadata.tags.has('special')).toBe(false);
    });

    test('records the prefab name on every spawned object', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });

      const object = prefab.buildObject(PREFAB_BUILD_TOKEN, createWorld());

      expect(object.metadata.prefabName).toBe('enemy');
    });

    test('clones the position so external mutation does not leak in', () => {
      const prefab = new Prefab({ name: 'enemy', components: {} });
      const position = new Point(10, 20);

      const object = prefab.buildObject(
        PREFAB_BUILD_TOKEN,
        createWorld(),
        position,
      );

      position.x = 999;

      expect(object.position.x).toBe(10);
    });
  });
});
