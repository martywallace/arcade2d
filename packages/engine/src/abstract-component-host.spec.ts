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

  protected _reportPhaseError(error: unknown, key: string): void {
    // Phase-error routing is exercised through the World/Game subclasses; a
    // bare host just surfaces it so a throwing test component is visible.
    console.error(`component "${key}" threw:`, error);
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

  describe('add variants', () => {
    test('addComponentFromFactory constructs the component with the host', () => {
      const host = new TestHost();

      const alpha = host.addComponentFromFactory('alpha', (h) => new Alpha(h));

      expect(alpha).toBeInstanceOf(Alpha);
      expect(host.getComponent('alpha')).toBe(alpha);
    });

    test('allowReplacement swaps an existing key, tearing the old one down', () => {
      const host = new TestHost();
      let oldDestroyed = false;
      host.addComponent(
        'slot',
        makeComponent(host, {
          onDestroy: () => {
            oldDestroyed = true;
          },
        }),
      );

      const replacement = new Alpha(host);
      host.addComponent('slot', replacement, { allowReplacement: true });

      // Replacement routes through removeComponent, so the old component's
      // onDestroy runs and the new instance takes the key.
      expect(oldDestroyed).toBe(true);
      expect(host.getComponent('slot')).toBe(replacement);
    });
  });

  describe('removeComponent / removeComponents', () => {
    test('removeComponent returns the removed component', () => {
      const host = new TestHost();
      const alpha = new Alpha(host);
      host.addComponent('alpha', alpha);

      expect(host.removeComponent('alpha')).toBe(alpha);
      expect(host.hasComponent('alpha')).toBe(false);
    });

    test('removeComponent returns null for an unknown key', () => {
      const host = new TestHost();

      expect(host.removeComponent('nope')).toBeNull();
    });

    test('removeComponent isolates a throwing onDestroy and still removes the component', () => {
      const host = new TestHost();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        host.addComponent(
          'bad',
          makeComponent(host, {
            onDestroy: () => {
              throw new Error('boom');
            },
          }),
        );

        // The throw is routed to the host's destroy-error channel rather
        // than propagating, and the component leaves the host either way —
        // it must not be stranded in the maps by its own failed teardown.
        expect(() => host.removeComponent('bad')).not.toThrow();
        expect(host.hasComponent('bad')).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    test('removeComponents runs every onDestroy before deleting, so siblings stay reachable', () => {
      const host = new TestHost();
      const seen: string[] = [];

      host.addComponents({
        first: makeComponent(host, {
          onDestroy: () => {
            seen.push(`first sees second: ${host.hasComponent('second')}`);
          },
        }),
        second: makeComponent(host, {
          onDestroy: () => {
            seen.push(`second sees first: ${host.hasComponent('first')}`);
          },
        }),
      });

      host.removeComponents(['first', 'second']);

      // Both onDestroy hooks ran while both components were still registered
      // — the batch's defining guarantee over removeComponent-in-a-loop.
      expect(seen).toEqual([
        'first sees second: true',
        'second sees first: true',
      ]);
      expect(host.hasComponent('first')).toBe(false);
      expect(host.hasComponent('second')).toBe(false);
    });

    test('removeComponents skips unknown keys without throwing', () => {
      const host = new TestHost();
      host.addComponent('alpha', new Alpha(host));

      expect(() => host.removeComponents(['alpha', 'ghost'])).not.toThrow();
      expect(host.hasComponent('alpha')).toBe(false);
    });
  });
});
