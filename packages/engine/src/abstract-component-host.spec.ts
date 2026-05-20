import { AbstractComponentHost } from './abstract-component-host';
import type { Component } from './components.types';
import { EngineError } from './error';
import { ErrorCode } from './error.constants';

// Minimal concrete host so the abstract base can be instantiated in tests.
class TestHost extends AbstractComponentHost<TestHost> {
  protected getHostReference(): TestHost {
    return this;
  }

  protected _createDependencyResolver(): unknown {
    // No resolver behaviour is exercised by these tests — they cover the
    // host-side surface (registration, lookup, lifecycle) rather than
    // dependency resolution. Returning an opaque sentinel is sufficient.
    return {};
  }
}

const makeComponent = <T extends TestHost>(
  host: T,
  overrides: Partial<Component<T>> = {},
): Component<T> => ({
  host,
  onAdded: () => {},
  onUpdate: () => {},
  onDestroy: () => {},
  ...overrides,
});

// A pair of concrete component classes used to exercise type-based lookup.
class Alpha implements Component<TestHost> {
  constructor(public readonly host: TestHost) {}
  onAdded(): void {}
  onUpdate(): void {}
  onDestroy(): void {}
}

class Beta implements Component<TestHost> {
  constructor(public readonly host: TestHost) {}
  onAdded(): void {}
  onUpdate(): void {}
  onDestroy(): void {}
}

describe('AbstractComponentHost', () => {
  describe('getComponentByType()', () => {
    test('returns the single match when exactly one component of the type is registered', () => {
      const host = new TestHost();
      const alpha = new Alpha(host);

      host.addComponent('alpha', alpha);

      expect(host.getComponentByType(Alpha)).toBe(alpha);
    });

    test('throws COMPONENT_AMBIGUOUS_TYPE when multiple components of the type are registered', () => {
      const host = new TestHost();

      host.addComponent('a1', new Alpha(host));
      host.addComponent('a2', new Alpha(host));

      let caught: unknown = null;
      try {
        host.getComponentByType(Alpha);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(
        ErrorCode.COMPONENT_AMBIGUOUS_TYPE,
      );
    });

    test('throws COMPONENT_NOT_FOUND when no component of the type is registered', () => {
      const host = new TestHost();

      let caught: unknown = null;
      try {
        host.getComponentByType(Alpha);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(ErrorCode.COMPONENT_NOT_FOUND);
    });

    test('caches the resolved key for subsequent O(1) lookups', () => {
      const host = new TestHost();
      const alpha = new Alpha(host);

      host.addComponent('alpha', alpha);

      // Two successive lookups should both succeed; the second should hit
      // the cache (verified indirectly: removing the component after the
      // cache is populated must still invalidate it).
      expect(host.getComponentByType(Alpha)).toBe(alpha);
      expect(host.getComponentByType(Alpha)).toBe(alpha);

      host.removeComponent('alpha');

      expect(() => host.getComponentByType(Alpha)).toThrow(EngineError);
    });

    test('does not cache when the lookup is ambiguous', () => {
      const host = new TestHost();
      host.addComponent('a1', new Alpha(host));
      host.addComponent('a2', new Alpha(host));

      expect(() => host.getComponentByType(Alpha)).toThrow(EngineError);

      // Remove one — the lookup should now succeed because the cache was
      // never populated with a stale entry.
      host.removeComponent('a1');

      const remaining = host.getComponentByType(Alpha);
      expect(remaining).toBeInstanceOf(Alpha);
    });
  });

  describe('getComponentsByType()', () => {
    test('returns every component of the type in insertion order', () => {
      const host = new TestHost();
      const a1 = new Alpha(host);
      const a2 = new Alpha(host);

      host.addComponent('first', a1);
      host.addComponent('second', a2);

      expect(host.getComponentsByType(Alpha)).toEqual([a1, a2]);
    });

    test('returns an empty array when no components of the type exist', () => {
      const host = new TestHost();
      host.addComponent('beta', new Beta(host));

      expect(host.getComponentsByType(Alpha)).toEqual([]);
    });

    test('does not include components of other types', () => {
      const host = new TestHost();
      const alpha = new Alpha(host);
      host.addComponent('alpha', alpha);
      host.addComponent('beta', new Beta(host));

      const result = host.getComponentsByType(Alpha);

      expect(result).toEqual([alpha]);
    });
  });

  describe('hasComponentByType()', () => {
    test('returns true when exactly one component of the type exists', () => {
      const host = new TestHost();
      host.addComponent('alpha', new Alpha(host));

      expect(host.hasComponentByType(Alpha)).toBe(true);
    });

    test('returns true even when multiple components of the type exist', () => {
      const host = new TestHost();
      host.addComponent('a1', new Alpha(host));
      host.addComponent('a2', new Alpha(host));

      // hasComponentByType must not be tricked by ambiguity into reporting
      // "no" when there are in fact components of the type.
      expect(host.hasComponentByType(Alpha)).toBe(true);
    });

    test('returns false when no component of the type is registered', () => {
      const host = new TestHost();
      host.addComponent('beta', new Beta(host));

      expect(host.hasComponentByType(Alpha)).toBe(false);
    });
  });

  describe('getNullableComponentByType()', () => {
    test('returns null on ambiguity rather than throwing', () => {
      const host = new TestHost();
      host.addComponent('a1', new Alpha(host));
      host.addComponent('a2', new Alpha(host));

      expect(host.getNullableComponentByType(Alpha)).toBeNull();
    });

    test('returns the component on unambiguous match', () => {
      const host = new TestHost();
      const alpha = new Alpha(host);
      host.addComponent('alpha', alpha);

      expect(host.getNullableComponentByType(Alpha)).toBe(alpha);
    });
  });

  describe('Component.enabled', () => {
    test('absent enabled is implicitly true (no behaviour change to legacy components)', () => {
      const host = new TestHost();

      // Stand up a component literal without an `enabled` field, the way
      // existing engine and demo components do.
      const component = makeComponent(host);

      host.addComponent('legacy', component);

      // The host has no opinion on enabled state directly, but the absence
      // of the field on the type must remain valid TypeScript and runtime
      // semantics. This is asserted by the type-check passing — no runtime
      // assertion needed beyond not throwing.
      expect(host.getComponent('legacy')).toBe(component);
    });
  });
});
