import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Prefab } from './prefab';
import { PrefabRegistry } from './prefab-registry';

const makePrefab = (name: string) => new Prefab({ name, components: {} });

describe('PrefabRegistry', () => {
  describe('register()', () => {
    test('stores a prefab under its name', () => {
      const registry = new PrefabRegistry();
      const enemy = makePrefab('enemy');

      registry.register(enemy);

      expect(registry.get('enemy')).toBe(enemy);
      expect(registry.size).toBe(1);
    });

    test('throws PREFAB_ALREADY_REGISTERED on a duplicate name', () => {
      const registry = new PrefabRegistry();
      registry.register(makePrefab('enemy'));

      let caught: unknown = null;

      try {
        registry.register(makePrefab('enemy'));
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(
        ErrorCode.PREFAB_ALREADY_REGISTERED,
      );
    });

    test('preserves the first registration on a duplicate attempt', () => {
      const registry = new PrefabRegistry();
      const first = makePrefab('enemy');
      const second = makePrefab('enemy');

      registry.register(first);
      expect(() => registry.register(second)).toThrow(EngineError);

      expect(registry.get('enemy')).toBe(first);
    });
  });

  describe('constructor seeding', () => {
    test('registers each seed prefab', () => {
      const a = makePrefab('a');
      const b = makePrefab('b');

      const registry = new PrefabRegistry([a, b]);

      expect(registry.size).toBe(2);
      expect(registry.get('a')).toBe(a);
      expect(registry.get('b')).toBe(b);
    });

    test('throws if two seeds share a name', () => {
      expect(
        () => new PrefabRegistry([makePrefab('enemy'), makePrefab('enemy')]),
      ).toThrow(EngineError);
    });
  });

  describe('unregister()', () => {
    test('removes a registered prefab and returns true', () => {
      const registry = new PrefabRegistry([makePrefab('enemy')]);

      expect(registry.unregister('enemy')).toBe(true);
      expect(registry.has('enemy')).toBe(false);
    });

    test('returns false when no prefab is registered under the name', () => {
      const registry = new PrefabRegistry();

      expect(registry.unregister('ghost')).toBe(false);
    });

    test('allows re-registration after unregister', () => {
      const registry = new PrefabRegistry([makePrefab('enemy')]);
      registry.unregister('enemy');

      const replacement = makePrefab('enemy');
      registry.register(replacement);

      expect(registry.get('enemy')).toBe(replacement);
    });
  });

  describe('lookup', () => {
    test('get() throws PREFAB_NOT_FOUND when the name is not registered', () => {
      const registry = new PrefabRegistry();

      let caught: unknown = null;

      try {
        registry.get('ghost');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(ErrorCode.PREFAB_NOT_FOUND);
    });

    test('getNullable() returns null when the name is not registered', () => {
      const registry = new PrefabRegistry();

      expect(registry.getNullable('ghost')).toBeNull();
    });

    test('getNullable() returns the prefab when the name is registered', () => {
      const enemy = makePrefab('enemy');
      const registry = new PrefabRegistry([enemy]);

      expect(registry.getNullable('enemy')).toBe(enemy);
    });

    test('has() reflects current registration state', () => {
      const registry = new PrefabRegistry();
      expect(registry.has('enemy')).toBe(false);

      registry.register(makePrefab('enemy'));
      expect(registry.has('enemy')).toBe(true);

      registry.unregister('enemy');
      expect(registry.has('enemy')).toBe(false);
    });
  });

  describe('snapshots', () => {
    test('names returns a snapshot that does not mutate the registry', () => {
      const registry = new PrefabRegistry([makePrefab('a'), makePrefab('b')]);

      const names = registry.names as string[];
      names.push('c');

      expect(registry.has('c')).toBe(false);
      expect(registry.size).toBe(2);
    });

    test('prefabs returns a snapshot of every registered prefab', () => {
      const a = makePrefab('a');
      const b = makePrefab('b');
      const registry = new PrefabRegistry([a, b]);

      expect(registry.prefabs).toEqual([a, b]);
    });
  });
});
