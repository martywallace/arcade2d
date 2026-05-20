import type { Component, ComponentHostConstructor } from '../components.types';
import type { World } from './world';
import type { WorldObject } from './world-object';
import type { WorldUpdate } from './world-update';

/**
 * A constructor reference suitable for the resolver's type-based lookup
 * methods. Re-exposed alias of {@link ComponentHostConstructor} so user code
 * importing the resolver doesn't need to dig into the components module to
 * find the right constructor type.
 */
export type DependencyComponentConstructor<T> = ComponentHostConstructor<T>;

/**
 * One record of a dependency lookup performed during a single component's
 * `resolveDependencies` call. The resolver records every `require*` /
 * `optional*` invocation so engine internals (and future devserver tooling)
 * can present a complete dependency graph without re-running resolution.
 */
export type DependencyLookupRecord = {
  /**
   * Where the resolver was asked to look — on the host the component is
   * being added to, or on the parent {@link World}.
   */
  readonly scope: 'sibling' | 'world';

  /**
   * Whether the lookup must succeed or is allowed to return `null`.
   */
  readonly mode: 'required' | 'optional';

  /**
   * The constructor passed to the resolver method.
   */
  readonly type: DependencyComponentConstructor<unknown>;

  /**
   * The resolved component, or `null` if the lookup was optional and
   * produced no match (or matched ambiguously).
   */
  readonly resolved: unknown;
};

/**
 * Dependency resolver passed to {@link WorldComponent.resolveDependencies}.
 * Exposes lookups against other components on the same {@link World} host;
 * does **not** expose a `requireFromWorld`-style escape hatch because
 * world components have no parent tier to reach into.
 *
 * Lookups are type-based: pass a component constructor, get the matching
 * instance back. The resolver throws an {@link EngineError} (with a
 * descriptive message naming the requesting component and the missing
 * type) when a required lookup can't be satisfied.
 */
export interface WorldDependencyResolver {
  /**
   * The {@link World} the component is being added to. Exposed so
   * components needing the host itself (rather than a sibling component)
   * don't have to capture it from elsewhere.
   */
  readonly host: World;

  /**
   * Resolves a sibling component on the same host by type. Throws
   * {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING} if no sibling of
   * the type exists, and
   * {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS} if more than
   * one does.
   *
   * Excludes the requesting component itself from the search — it doesn't
   * count as its own sibling.
   *
   * @param type The constructor of the sibling component to resolve.
   * @returns The single matching sibling instance.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING} or
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS}.
   */
  requireSibling<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T;

  /**
   * Same as {@link WorldDependencyResolver.requireSibling} but returns
   * `null` instead of throwing on miss or ambiguity. The two failure modes
   * collapse to a single `null` — use {@link WorldDependencyResolver.requireSibling}
   * if you need to distinguish them.
   *
   * @param type The constructor of the sibling component to resolve.
   * @returns The matching sibling instance, or `null` if not found or
   *   ambiguous.
   */
  optionalSibling<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T | null;
}

/**
 * Dependency resolver passed to
 * {@link WorldObjectComponent.resolveDependencies}. Exposes both sibling
 * lookups (other components on the same {@link WorldObject}) and
 * cross-tier lookups against the parent {@link World}'s components.
 *
 * The cross-tier methods are the canonical way for object-scoped
 * components to declare a dependency on world-scoped infrastructure —
 * a graphics component reaching for the renderer, a physics body reaching
 * for the simulation, an audio source reaching for the mixer.
 */
export interface WorldObjectDependencyResolver {
  /**
   * The {@link WorldObject} the component is being added to.
   */
  readonly host: WorldObject;

  /**
   * Resolves a sibling component on the same host by type.
   *
   * @param type The constructor of the sibling component to resolve.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING} or
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS}.
   */
  requireSibling<T extends Component<WorldObject>>(
    type: DependencyComponentConstructor<T>,
  ): T;

  /**
   * Same as {@link WorldObjectDependencyResolver.requireSibling} but
   * returns `null` on miss or ambiguity instead of throwing.
   */
  optionalSibling<T extends Component<WorldObject>>(
    type: DependencyComponentConstructor<T>,
  ): T | null;

  /**
   * Resolves a component on the parent {@link World} by type. This is the
   * mechanism for object-scoped components that need to talk to
   * world-scoped infrastructure.
   *
   * @param type The constructor of the world-scoped component to resolve.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING} or
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS}.
   */
  requireFromWorld<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T;

  /**
   * Same as {@link WorldObjectDependencyResolver.requireFromWorld} but
   * returns `null` on miss or ambiguity.
   */
  optionalFromWorld<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T | null;
}

/**
 * A component attached to the {@link World} itself. Use this rather than
 * the lower-level {@link Component} interface whenever you're writing a
 * world-scoped system — input samplers, physics broadphases, renderers,
 * audio mixers, scene graphs — both because the name reads better in
 * docs/imports and because the dependency resolver is typed correctly for
 * the world tier (no `requireFromWorld`, because there's no tier above).
 *
 * ### Declaring dependencies
 *
 * Implement the optional `resolveDependencies` method to declare what
 * other components this one needs in place. The return value's shape
 * becomes the `TDeps` generic parameter, which then types the `deps`
 * argument of every other lifecycle hook.
 *
 * ```typescript
 * type PhysicsDeps = { input: InputSystem };
 *
 * class PhysicsSystem implements WorldComponent<PhysicsDeps> {
 *   constructor(public readonly host: World) {}
 *
 *   resolveDependencies(resolver: WorldDependencyResolver): PhysicsDeps {
 *     return { input: resolver.requireSibling(InputSystem) };
 *   }
 *
 *   onAdded({ input }: PhysicsDeps): void { ... }
 *   onUpdate(update: WorldUpdate, { input }: PhysicsDeps): void { ... }
 *   onDestroy({ input }: PhysicsDeps): void { ... }
 * }
 * ```
 *
 * @template TDeps The shape of the resolved dependencies threaded into
 * every lifecycle hook. Defaults to an empty object for components with
 * no dependencies — they can implement the interface and simply omit the
 * trailing `deps` parameter at each hook.
 */
export interface WorldComponent<
  TDeps = Record<string, never>,
> extends Component<World, TDeps> {
  /**
   * Optional dependency declaration. Called by the engine immediately
   * after the component is registered with the host, before `onAdded`. The
   * returned object becomes the `deps` argument threaded into every
   * subsequent lifecycle hook.
   *
   * If this method throws, the component is removed from the host and the
   * error propagates out of the `addComponent` / `addComponents` call —
   * the component never sees `onAdded`. This is the engine's atomic-add
   * contract.
   *
   * @param resolver The {@link WorldDependencyResolver} for this resolve.
   */
  resolveDependencies?(resolver: WorldDependencyResolver): TDeps;
}

/**
 * A component attached to a {@link WorldObject}. Use this rather than the
 * lower-level {@link Component} interface for any per-object behaviour —
 * controllers, graphics, colliders, audio sources, gameplay logic — both
 * because the name reads better in docs/imports and because the dependency
 * resolver also exposes cross-tier lookups against the parent {@link World}
 * via `requireFromWorld` / `optionalFromWorld`.
 *
 * ### Declaring dependencies on world-scoped infrastructure
 *
 * The canonical use case for object-component dependencies is "I need to
 * talk to a world-scoped system." A graphics component needs the renderer.
 * A physics body needs the simulation. An audio source needs the mixer.
 *
 * ```typescript
 * type GraphicsDeps = { renderer: RendererSystem };
 *
 * class GraphicsComponent implements WorldObjectComponent<GraphicsDeps> {
 *   constructor(public readonly host: WorldObject) {}
 *
 *   resolveDependencies(
 *     resolver: WorldObjectDependencyResolver,
 *   ): GraphicsDeps {
 *     return { renderer: resolver.requireFromWorld(RendererSystem) };
 *   }
 *
 *   onAdded({ renderer }: GraphicsDeps): void {
 *     renderer.register(this);
 *   }
 *
 *   onDestroy({ renderer }: GraphicsDeps): void {
 *     renderer.unregister(this);
 *   }
 * }
 * ```
 *
 * @template TDeps The shape of the resolved dependencies. Defaults to an
 * empty object for components with no dependencies.
 */
export interface WorldObjectComponent<
  TDeps = Record<string, never>,
> extends Component<WorldObject, TDeps> {
  /**
   * Optional dependency declaration. See
   * {@link WorldComponent.resolveDependencies} for the lifecycle contract.
   *
   * @param resolver The {@link WorldObjectDependencyResolver} for this
   * resolve, exposing both sibling and parent-world lookups.
   */
  resolveDependencies?(resolver: WorldObjectDependencyResolver): TDeps;
}

/**
 * Marker for the {@link WorldUpdate} type re-export so consumers can import
 * the lifecycle update payload alongside the component types without
 * dipping into a separate module.
 */
export type { WorldUpdate };
