import { Component } from '../components';
import { EngineError, ErrorCode } from '../error';
import { WorldUpdate } from './update';
import { World } from './world';
import { WorldObject } from './world-object';
import {
  WorldComponent,
  WorldDependencyResolver,
  WorldObjectComponent,
  WorldObjectDependencyResolver,
} from './dependencies';

// World-scoped component used as a dependency target across the suite.
class InputSystem implements WorldComponent {
  constructor(public readonly host: World) {}
  onAdded(): void {}
  onUpdate(): void {}
  onDestroy(): void {}
}

// A second world-scoped component used for sibling resolution tests on the
// World host.
class AudioMixer implements WorldComponent {
  constructor(public readonly host: World) {}
  onAdded(): void {}
  onUpdate(): void {}
  onDestroy(): void {}
}

// A world-scoped component with a sibling dependency, exercising
// WorldDependencyResolver.requireSibling.
type PhysicsDeps = { readonly input: InputSystem };

class PhysicsSystem implements WorldComponent<PhysicsDeps> {
  public addedWith: PhysicsDeps | null = null;
  public updatedWith: PhysicsDeps | null = null;

  constructor(public readonly host: World) {}

  resolveDependencies(resolver: WorldDependencyResolver): PhysicsDeps {
    return { input: resolver.requireSibling(InputSystem) };
  }

  onAdded(deps: PhysicsDeps): void {
    this.addedWith = deps;
  }

  onUpdate(_update: WorldUpdate, deps: PhysicsDeps): void {
    this.updatedWith = deps;
  }

  onDestroy(): void {}
}

// Object-scoped component that requires a world-scoped sibling. Exercises
// the cross-tier requireFromWorld path.
type GraphicsDeps = { readonly input: InputSystem };

class GraphicsComponent implements WorldObjectComponent<GraphicsDeps> {
  public addedWith: GraphicsDeps | null = null;
  public destroyedWith: GraphicsDeps | null = null;

  constructor(public readonly host: WorldObject) {}

  resolveDependencies(resolver: WorldObjectDependencyResolver): GraphicsDeps {
    return { input: resolver.requireFromWorld(InputSystem) };
  }

  onAdded(deps: GraphicsDeps): void {
    this.addedWith = deps;
  }

  onUpdate(): void {}

  onDestroy(deps: GraphicsDeps): void {
    this.destroyedWith = deps;
  }
}

// A component used for ambiguity tests on the WorldObject tier.
class Tracker implements Component<WorldObject> {
  constructor(public readonly host: WorldObject) {}
  onAdded(): void {}
  onUpdate(): void {}
  onDestroy(): void {}
}

const captureError = (fn: () => void): EngineError => {
  try {
    fn();
  } catch (error) {
    if (error instanceof EngineError) {
      return error;
    }
    throw error;
  }

  throw new Error('Expected EngineError to be thrown, none was');
};

describe('dependency resolution', () => {
  describe('WorldComponent.resolveDependencies', () => {
    test('threads the resolved deps into every hook the component implements', () => {
      let physics: PhysicsSystem | null = null;

      const world = new World({
        components: (w) => ({
          input: () => new InputSystem(w),
          physics: () => {
            physics = new PhysicsSystem(w);
            return physics;
          },
        }),
      });

      // onAdded received the resolved sibling.
      expect(physics).not.toBeNull();
      const p = physics!;
      expect(p.addedWith).not.toBeNull();
      expect(p.addedWith?.input).toBeInstanceOf(InputSystem);

      // onUpdate also sees the same deps reference on every tick.
      world.update();
      expect(p.updatedWith).toBe(p.addedWith);
    });

    test('throws WORLD_COMPONENT_DEPENDENCY_MISSING when a required sibling is absent', () => {
      const error = captureError(() => {
        new World({
          // physics requires InputSystem but the world never registers one.
          components: (w) => ({
            physics: () => new PhysicsSystem(w),
          }),
        });
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING);
      expect(error.message).toContain('PhysicsSystem');
      expect(error.message).toContain('InputSystem');
    });

    test('throws WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS when a required sibling matches multiply', () => {
      const error = captureError(() => {
        new World({
          components: (w) => ({
            input1: () => new InputSystem(w),
            input2: () => new InputSystem(w),
            physics: () => new PhysicsSystem(w),
          }),
        });
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS);
      expect(error.message).toContain('InputSystem');
      expect(error.message).toContain('"input1"');
      expect(error.message).toContain('"input2"');
    });

    test('does not match itself when resolving siblings of its own type', () => {
      // A component that calls requireSibling(SameType) on itself should
      // miss — sibling means "other components on the host," never self.
      class SelfReferential implements WorldComponent<{ other: SelfReferential }> {
        constructor(public readonly host: World) {}

        resolveDependencies(
          resolver: WorldDependencyResolver,
        ): { other: SelfReferential } {
          return { other: resolver.requireSibling(SelfReferential) };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const error = captureError(() => {
        new World({
          components: (w) => ({ self: () => new SelfReferential(w) }),
        });
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING);
    });

    test('optionalSibling returns the resolved match', () => {
      class OptionalPhysics implements WorldComponent<{ input: InputSystem | null }> {
        public resolved: InputSystem | null = null;

        constructor(public readonly host: World) {}

        resolveDependencies(
          resolver: WorldDependencyResolver,
        ): { input: InputSystem | null } {
          const input = resolver.optionalSibling(InputSystem);
          this.resolved = input;
          return { input };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      let instance: OptionalPhysics | null = null;

      new World({
        components: (w) => ({
          input: () => new InputSystem(w),
          physics: () => {
            instance = new OptionalPhysics(w);
            return instance;
          },
        }),
      });

      expect(instance).not.toBeNull();
      expect(instance!.resolved).toBeInstanceOf(InputSystem);
    });

    test('optionalSibling returns null when no match exists', () => {
      class OptionalPhysics implements WorldComponent<{ input: InputSystem | null }> {
        public resolved: InputSystem | null = 'sentinel' as never;

        constructor(public readonly host: World) {}

        resolveDependencies(
          resolver: WorldDependencyResolver,
        ): { input: InputSystem | null } {
          const input = resolver.optionalSibling(InputSystem);
          this.resolved = input;
          return { input };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      let instance: OptionalPhysics | null = null;

      new World({
        components: (w) => ({
          physics: () => {
            instance = new OptionalPhysics(w);
            return instance;
          },
        }),
      });

      expect(instance!.resolved).toBeNull();
    });

    test('optionalSibling collapses ambiguous matches to null instead of throwing', () => {
      class OptionalPhysics implements WorldComponent<{ input: InputSystem | null }> {
        public resolved: InputSystem | null = 'sentinel' as never;

        constructor(public readonly host: World) {}

        resolveDependencies(
          resolver: WorldDependencyResolver,
        ): { input: InputSystem | null } {
          const input = resolver.optionalSibling(InputSystem);
          this.resolved = input;
          return { input };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      let instance: OptionalPhysics | null = null;

      new World({
        components: (w) => ({
          input1: () => new InputSystem(w),
          input2: () => new InputSystem(w),
          physics: () => {
            instance = new OptionalPhysics(w);
            return instance;
          },
        }),
      });

      expect(instance!.resolved).toBeNull();
    });

    test('exposes the host on the resolver so components can capture it', () => {
      let capturedHost: World | null = null;

      class HostCapturing implements WorldComponent {
        constructor(public readonly host: World) {}

        resolveDependencies(resolver: WorldDependencyResolver): Record<string, never> {
          capturedHost = resolver.host;
          return {};
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const world = new World({
        components: (w) => ({
          capture: () => new HostCapturing(w),
        }),
      });

      expect(capturedHost).toBe(world);
    });
  });

  describe('WorldObjectComponent.resolveDependencies', () => {
    test('requireFromWorld resolves a component on the parent world', () => {
      const world = new World({
        components: (w) => ({ input: () => new InputSystem(w) }),
      });

      const object = world.createEmpty();
      const graphics = new GraphicsComponent(object);

      object.addComponent('graphics', graphics);

      expect(graphics.addedWith?.input).toBeInstanceOf(InputSystem);
    });

    test('threads the same deps reference into onDestroy', () => {
      const world = new World({
        components: (w) => ({ input: () => new InputSystem(w) }),
      });

      const object = world.createEmpty();
      const graphics = new GraphicsComponent(object);

      object.addComponent('graphics', graphics);
      const addedDeps = graphics.addedWith;

      object.removeComponent('graphics');
      expect(graphics.destroyedWith).toBe(addedDeps);
    });

    test('throws WORLD_COMPONENT_DEPENDENCY_MISSING when the required world component is absent', () => {
      const world = new World({
        components: () => ({}),
      });

      const object = world.createEmpty();
      const graphics = new GraphicsComponent(object);

      const error = captureError(() => {
        object.addComponent('graphics', graphics);
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING);
      expect(error.message).toContain('GraphicsComponent');
      expect(error.message).toContain('InputSystem');
      expect(error.message).toContain('World');
    });

    test('throws WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS when the world has multiple matches', () => {
      const world = new World({
        components: (w) => ({
          inputA: () => new InputSystem(w),
          inputB: () => new InputSystem(w),
        }),
      });

      const object = world.createEmpty();
      const graphics = new GraphicsComponent(object);

      const error = captureError(() => {
        object.addComponent('graphics', graphics);
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS);
    });

    test('sibling lookups on the object tier do not reach into the world', () => {
      // The type system already enforces this: requireSibling on a
      // WorldObjectDependencyResolver only accepts Component<WorldObject>
      // constructors — you can't even pass it an InputSystem (which is a
      // Component<World>). So the runtime exercise here is the parallel
      // case: a sibling component class that legally exists at both tiers
      // should only resolve on the object tier when asked from the
      // object's resolver.
      class SharedShape implements Component<WorldObject> {
        constructor(public readonly host: WorldObject) {}
        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      class SharedShapeFinder
        implements WorldObjectComponent<{ shared: SharedShape }> {
        constructor(public readonly host: WorldObject) {}

        resolveDependencies(
          resolver: WorldObjectDependencyResolver,
        ): { shared: SharedShape } {
          return { shared: resolver.requireSibling(SharedShape) };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const world = new World({ components: () => ({}) });
      const object = world.createEmpty();

      // No sibling exists — the resolver must not hop to the world tier
      // hunting for one.
      const error = captureError(() => {
        object.addComponent('finder', new SharedShapeFinder(object));
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING);
      expect(error.message).toContain('sibling on the same host');
    });

    test('optionalFromWorld returns null when the world component is missing', () => {
      class OptionalGraphics
        implements WorldObjectComponent<{ input: InputSystem | null }> {
        public resolved: InputSystem | null = 'sentinel' as never;

        constructor(public readonly host: WorldObject) {}

        resolveDependencies(
          resolver: WorldObjectDependencyResolver,
        ): { input: InputSystem | null } {
          const input = resolver.optionalFromWorld(InputSystem);
          this.resolved = input;
          return { input };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const world = new World({ components: () => ({}) });
      const object = world.createEmpty();
      const graphics = new OptionalGraphics(object);

      object.addComponent('graphics', graphics);
      expect(graphics.resolved).toBeNull();
    });

    test('object-tier ambiguous sibling throws AMBIGUOUS', () => {
      class TrackerObserver
        implements WorldObjectComponent<{ tracker: Tracker }> {
        constructor(public readonly host: WorldObject) {}

        resolveDependencies(
          resolver: WorldObjectDependencyResolver,
        ): { tracker: Tracker } {
          return { tracker: resolver.requireSibling(Tracker) };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const world = new World({ components: () => ({}) });
      const object = world.createEmpty();

      object.addComponent('t1', new Tracker(object));
      object.addComponent('t2', new Tracker(object));

      const error = captureError(() => {
        object.addComponent('obs', new TrackerObserver(object));
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS);
    });
  });

  describe('atomic add semantics', () => {
    test('the failing component is not committed to the host when its resolve throws', () => {
      const world = new World({ components: () => ({}) });
      const object = world.createEmpty();
      const graphics = new GraphicsComponent(object);

      try {
        object.addComponent('graphics', graphics);
      } catch {
        // expected
      }

      expect(object.hasComponent('graphics')).toBe(false);
    });

    test('onAdded is not called on a component whose resolve throws', () => {
      const world = new World({ components: () => ({}) });
      const object = world.createEmpty();
      const graphics = new GraphicsComponent(object);

      try {
        object.addComponent('graphics', graphics);
      } catch {
        // expected
      }

      expect(graphics.addedWith).toBeNull();
    });

    test('a batched add rolls back every new component when any one fails to resolve', () => {
      class AlwaysFails
        implements WorldObjectComponent<{ input: InputSystem }> {
        constructor(public readonly host: WorldObject) {}

        resolveDependencies(
          resolver: WorldObjectDependencyResolver,
        ): { input: InputSystem } {
          return { input: resolver.requireFromWorld(InputSystem) };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const world = new World({ components: () => ({}) });
      const object = world.createEmpty();

      try {
        object.addComponents({
          first: new Tracker(object),
          second: new AlwaysFails(object), // throws — InputSystem missing
        });
      } catch {
        // expected
      }

      // The first component must also have been rolled back, not just the
      // failing one — the host should look identical to its pre-batch state.
      expect(object.hasComponent('first')).toBe(false);
      expect(object.hasComponent('second')).toBe(false);
    });
  });

  describe('re-entrancy protection', () => {
    test('throws WORLD_COMPONENT_DEPENDENCY_REENTRANT if addComponent is called from inside resolveDependencies', () => {
      class Reentrant implements WorldComponent {
        constructor(public readonly host: World) {}

        resolveDependencies(resolver: WorldDependencyResolver): Record<string, never> {
          // Illegal: trying to mutate the host's component set mid-resolve.
          resolver.host.addComponent('sneaky', new InputSystem(resolver.host));
          return {};
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const error = captureError(() => {
        new World({
          components: (w) => ({ bad: () => new Reentrant(w) }),
        });
      });

      expect(error.code).toBe(ErrorCode.WORLD_COMPONENT_DEPENDENCY_REENTRANT);
    });
  });

  describe('no-deps components', () => {
    test('components without resolveDependencies receive an empty deps object', () => {
      let capturedDeps: unknown = 'never-set';

      class Bare implements WorldComponent {
        constructor(public readonly host: World) {}

        onAdded(deps: Record<string, never>): void {
          capturedDeps = deps;
        }

        onUpdate(): void {}
        onDestroy(): void {}
      }

      new World({
        components: (w) => ({ bare: () => new Bare(w) }),
      });

      expect(capturedDeps).toBeDefined();
      expect(capturedDeps).not.toBe('never-set');
    });

    test('legacy Component-shaped object literals continue to work without modification', () => {
      // The interface widening that added `deps: TDeps` to every hook must
      // remain backward-compatible: omitting the trailing parameter at the
      // implementation site is valid TypeScript and valid runtime
      // behaviour.
      let addedCalls = 0;
      let updateCalls = 0;
      let destroyCalls = 0;

      const world = new World({
        components: (w) => ({
          legacy: () => ({
            host: w,
            onAdded() {
              addedCalls++;
            },
            onUpdate() {
              updateCalls++;
            },
            onDestroy() {
              destroyCalls++;
            },
          }),
        }),
      });

      expect(addedCalls).toBe(1);
      world.update();
      expect(updateCalls).toBe(1);
      world.destroy();
      expect(destroyCalls).toBe(1);
    });
  });

  describe('lookup records', () => {
    test('the resolver records every lookup it performs', () => {
      // We can't reach the resolver instance directly from user code — it
      // lives in the engine — but we can construct one and exercise it
      // through the existing public path by using a component that
      // captures everything in flight.
      class RecordingProbe
        implements WorldObjectComponent<{
          requireResult: InputSystem;
          optionalResult: Tracker | null;
        }> {
        public capturedResolver: WorldObjectDependencyResolver | null = null;

        constructor(public readonly host: WorldObject) {}

        resolveDependencies(resolver: WorldObjectDependencyResolver): {
          requireResult: InputSystem;
          optionalResult: Tracker | null;
        } {
          this.capturedResolver = resolver;
          const requireResult = resolver.requireFromWorld(InputSystem);
          const optionalResult = resolver.optionalSibling(Tracker);
          return { requireResult, optionalResult };
        }

        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const world = new World({
        components: (w) => ({ input: () => new InputSystem(w) }),
      });

      const object = world.createEmpty();
      const probe = new RecordingProbe(object);

      object.addComponent('probe', probe);

      // The captured resolver carries the lookup record for diagnostics.
      const record = (
        probe.capturedResolver as unknown as {
          lookups: { scope: string; mode: string; resolved: unknown }[];
        }
      ).lookups;

      expect(record).toHaveLength(2);
      expect(record[0]).toMatchObject({ scope: 'world', mode: 'required' });
      expect(record[1]).toMatchObject({ scope: 'sibling', mode: 'optional' });
      expect(record[1]?.resolved).toBeNull();
    });
  });

  describe('integration with the World/WorldObject tick', () => {
    test('AudioMixer + InputSystem siblings cohabit cleanly via insertion-order resolution', () => {
      class MixerWithInput implements WorldComponent<{ input: InputSystem }> {
        public addedDeps: { input: InputSystem } | null = null;

        constructor(public readonly host: World) {}

        resolveDependencies(
          resolver: WorldDependencyResolver,
        ): { input: InputSystem } {
          return { input: resolver.requireSibling(InputSystem) };
        }

        onAdded(deps: { input: InputSystem }): void {
          this.addedDeps = deps;
        }

        onUpdate(): void {}
        onDestroy(): void {}
      }

      let mixer: MixerWithInput | null = null;

      new World({
        components: (w) => ({
          input: () => new InputSystem(w),
          mixer: () => {
            mixer = new MixerWithInput(w);
            return mixer;
          },
          audio: () => new AudioMixer(w),
        }),
      });

      expect(mixer!.addedDeps).not.toBeNull();
    });
  });
});
