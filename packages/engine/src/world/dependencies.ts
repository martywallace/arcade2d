import {
  AbstractComponent,
  AbstractComponentHost,
  Component,
  ComponentHostConstructor,
} from '../components';
import { ErrorCode, throwEngineError } from '../error';
import type { Game } from '../game';
import { WorldUpdate } from './update';
import { World } from './world';
import { WorldObject } from './world-object';

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
export interface WorldComponent<TDeps = Record<string, never>>
  extends Component<World, TDeps> {
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
export interface WorldObjectComponent<TDeps = Record<string, never>>
  extends Component<WorldObject, TDeps> {
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
 * Common machinery used by both {@link WorldComponentDependencyResolver}
 * and {@link WorldObjectComponentDependencyResolver}. The two concrete
 * resolvers differ only in which lookup methods they expose; the lookup
 * logic itself is shared here.
 *
 * @internal
 */
abstract class AbstractDependencyResolver<
  THost extends AbstractComponentHost<THost>,
> {
  /**
   * Record of every lookup performed during this resolve. Engine-internal
   * for now; will be surfaced to the devserver/editor later.
   */
  public readonly lookups: DependencyLookupRecord[] = [];

  constructor(
    protected readonly _host: THost,
    protected readonly _requester: Component<THost>,
    protected readonly _requesterKey: string,
  ) {}

  /**
   * Walks the host's components, returning every instance of `type`
   * except the requesting component itself. Self-matching would be
   * surprising — `requireSibling(MyType)` returning the caller is almost
   * never what users want.
   */
  protected _findSiblingMatches<T>(
    host: AbstractComponentHost<never>,
    type: DependencyComponentConstructor<T>,
    excludeSelf: boolean,
  ): { keys: string[]; instances: T[] } {
    const keys: string[] = [];
    const instances: T[] = [];

    for (const [key, component] of (
      host as unknown as { components: Map<string, unknown> }
    ).components) {
      if (excludeSelf && component === this._requester) {
        continue;
      }

      if (component instanceof type) {
        keys.push(key);
        instances.push(component);
      }
    }

    return { keys, instances };
  }

  /**
   * Shared required-lookup implementation. Builds rich error context so
   * the user sees which component asked for what and where.
   */
  protected _resolveRequired<T>(
    scope: 'sibling' | 'world',
    lookupHost: AbstractComponentHost<never>,
    type: DependencyComponentConstructor<T>,
  ): T {
    const excludeSelf = scope === 'sibling';
    const { keys, instances } = this._findSiblingMatches(
      lookupHost,
      type,
      excludeSelf,
    );

    if (instances.length === 0) {
      this.lookups.push({
        scope,
        mode: 'required',
        type: type as DependencyComponentConstructor<unknown>,
        resolved: null,
      });

      throwEngineError(
        ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING,
        this._formatMissingMessage(scope, type),
        {
          requesterKey: this._requesterKey,
          requesterType: this._requester.constructor.name,
          requiredType: type.name,
          scope,
          host: this._host,
        },
      );
    }

    if (instances.length > 1) {
      this.lookups.push({
        scope,
        mode: 'required',
        type: type as DependencyComponentConstructor<unknown>,
        resolved: null,
      });

      throwEngineError(
        ErrorCode.WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS,
        this._formatAmbiguousMessage(scope, type, keys),
        {
          requesterKey: this._requesterKey,
          requesterType: this._requester.constructor.name,
          requiredType: type.name,
          scope,
          matchedKeys: keys,
          host: this._host,
        },
      );
    }

    const resolved = instances[0] as T;
    this.lookups.push({
      scope,
      mode: 'required',
      type: type as DependencyComponentConstructor<unknown>,
      resolved,
    });

    return resolved;
  }

  /**
   * Shared optional-lookup implementation. Returns `null` for both miss
   * and ambiguity, mirroring {@link AbstractComponentHost.getNullableComponentByType}.
   */
  protected _resolveOptional<T>(
    scope: 'sibling' | 'world',
    lookupHost: AbstractComponentHost<never>,
    type: DependencyComponentConstructor<T>,
  ): T | null {
    const excludeSelf = scope === 'sibling';
    const { instances } = this._findSiblingMatches(
      lookupHost,
      type,
      excludeSelf,
    );

    const resolved = instances.length === 1 ? (instances[0] as T) : null;

    this.lookups.push({
      scope,
      mode: 'optional',
      type: type as DependencyComponentConstructor<unknown>,
      resolved,
    });

    return resolved;
  }

  private _formatMissingMessage(
    scope: 'sibling' | 'world',
    type: DependencyComponentConstructor<unknown>,
  ): string {
    const requesterType = this._requester.constructor.name;
    const where = scope === 'sibling' ? 'sibling on the same host' : 'World';

    return (
      `${requesterType} (registered as "${this._requesterKey}") requires a ` +
      `${type.name} as a ${where}, but none was found. Register a ${type.name} ` +
      `on the ${
        scope === 'sibling' ? 'host' : 'World'
      } before this component, or use the optional resolver method ` +
      `if the dependency is genuinely optional.`
    );
  }

  private _formatAmbiguousMessage(
    scope: 'sibling' | 'world',
    type: DependencyComponentConstructor<unknown>,
    matchedKeys: readonly string[],
  ): string {
    const requesterType = this._requester.constructor.name;
    const where = scope === 'sibling' ? 'on the host' : 'on the World';
    const keys = matchedKeys.map((k) => `"${k}"`).join(', ');

    return (
      `${requesterType} (registered as "${this._requesterKey}") requires a ` +
      `single ${type.name} ${where}, but ${matchedKeys.length} matched ` +
      `(${keys}). Either register only one ${type.name}, or look it up by ` +
      `key inside an explicit lifecycle hook rather than as a dependency.`
    );
  }
}

/**
 * Concrete {@link WorldDependencyResolver} implementation. Constructed
 * per resolve call so the recorded `lookups` reflect a single component's
 * resolution.
 *
 * @internal
 */
export class WorldComponentDependencyResolver
  extends AbstractDependencyResolver<World>
  implements WorldDependencyResolver
{
  public get host(): World {
    return this._host;
  }

  public requireSibling<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T {
    return this._resolveRequired(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public optionalSibling<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T | null {
    return this._resolveOptional(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }
}

/**
 * Concrete {@link WorldObjectDependencyResolver} implementation.
 *
 * @internal
 */
export class WorldObjectComponentDependencyResolver
  extends AbstractDependencyResolver<WorldObject>
  implements WorldObjectDependencyResolver
{
  public get host(): WorldObject {
    return this._host;
  }

  public requireSibling<T extends Component<WorldObject>>(
    type: DependencyComponentConstructor<T>,
  ): T {
    return this._resolveRequired(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public optionalSibling<T extends Component<WorldObject>>(
    type: DependencyComponentConstructor<T>,
  ): T | null {
    return this._resolveOptional(
      'sibling',
      this._host as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public requireFromWorld<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T {
    return this._resolveRequired(
      'world',
      this._host.world as unknown as AbstractComponentHost<never>,
      type,
    );
  }

  public optionalFromWorld<T extends Component<World>>(
    type: DependencyComponentConstructor<T>,
  ): T | null {
    return this._resolveOptional(
      'world',
      this._host.world as unknown as AbstractComponentHost<never>,
      type,
    );
  }
}

/**
 * Marker for the {@link WorldUpdate} type re-export so consumers can import
 * the lifecycle update payload alongside the component types without
 * dipping into a separate module.
 */
export type { WorldUpdate };

/**
 * Abstract base class for components attached to a {@link World}.
 *
 * The recommended way to implement the {@link WorldComponent} contract.
 * Supplies the boilerplate every world-scoped system would otherwise
 * write by hand:
 *
 * - The {@link AbstractComponent.host} reference, typed as {@link World}.
 * - A {@link AbstractWorldComponent.world} alias (identical to `host`
 *   at this tier) so subclass code reads symmetrically with the
 *   {@link AbstractWorldObjectComponent} convenience.
 * - A {@link AbstractWorldComponent.game} accessor that hops through
 *   the world to the parent {@link Game} — the single-step way to reach
 *   page-scoped services like the keyboard or mouse samplers.
 * - No-op default implementations of the required lifecycle hooks
 *   (`onAdded`, `onUpdate`, `onDestroy`) so subclasses only override
 *   the ones they actually use. The optional `onPreUpdate` and
 *   `onPostUpdate` hooks remain opt-in — declare them only when
 *   needed.
 *
 * Subclasses that take additional constructor arguments must define
 * their own constructor and forward `host` via `super(host)`. Subclasses
 * that need nothing beyond the host can omit the constructor entirely
 * and inherit the one on this base.
 *
 * @template TDeps The shape of the resolved dependencies threaded into
 * every lifecycle hook. Defaults to an empty object for components with
 * no dependencies — they can omit the `deps` parameter at each hook
 * entirely.
 *
 * @example
 * ```typescript
 * class PauseGate extends AbstractWorldComponent {
 *   public onUpdate(): void {
 *     if (this.game.getKeyboardState().isDown('Escape')) {
 *       this.world.enabled = false;
 *     }
 *   }
 * }
 * ```
 */
export abstract class AbstractWorldComponent<TDeps = Record<string, never>>
  extends AbstractComponent<World>
  implements WorldComponent<TDeps>
{
  /**
   * The {@link World} this component is attached to — identical to
   * {@link AbstractComponent.host} at this tier, exposed under the
   * `world` name so subclass code reads the same on every tier.
   */
  public get world(): World {
    return this.host;
  }

  /**
   * The {@link Game} the host world belongs to. Always non-null — the
   * world's `game` field is a mandatory construction argument, not an
   * option.
   */
  public get game(): Game {
    return this.host.game;
  }

  public onAdded(_deps: TDeps): void {}

  public onUpdate(_update: WorldUpdate, _deps: TDeps): void {}

  public onDestroy(_deps: TDeps): void {}
}

/**
 * Abstract base class for components attached to a {@link WorldObject}.
 *
 * The recommended way to implement the {@link WorldObjectComponent}
 * contract. Supplies the boilerplate every per-object system would
 * otherwise write by hand:
 *
 * - The {@link AbstractComponent.host} reference, typed as
 *   {@link WorldObject}.
 * - A {@link AbstractWorldObjectComponent.world} accessor that hops
 *   through the host to the parent {@link World} — the short-hand for
 *   the very common `this.host.world.findOneByTag(...)` /
 *   `this.host.world.camera.shake(...)` patterns.
 * - A {@link AbstractWorldObjectComponent.game} accessor that hops
 *   one further through the world to the {@link Game} — the single-step
 *   way to reach page-scoped services like the keyboard or mouse
 *   samplers from inside per-object behaviour code.
 * - No-op default implementations of the required lifecycle hooks
 *   (`onAdded`, `onUpdate`, `onDestroy`) so subclasses only override
 *   the ones they actually use.
 *
 * Subclasses that take additional constructor arguments must define
 * their own constructor and forward `host` via `super(host)`.
 *
 * @template TDeps The shape of the resolved dependencies threaded into
 * every lifecycle hook. Defaults to an empty object for components with
 * no dependencies — they can omit the `deps` parameter at each hook
 * entirely.
 *
 * @example
 * ```typescript
 * class WASDController extends AbstractWorldObjectComponent {
 *   public onUpdate(update: WorldUpdate): void {
 *     const keys = this.game.getKeyboardState();
 *     const speed = 0.2 * update.deltaMilliseconds;
 *
 *     if (keys.isDown('KeyW')) this.host.position.y -= speed;
 *     if (keys.isDown('KeyS')) this.host.position.y += speed;
 *     if (keys.isDown('KeyA')) this.host.position.x -= speed;
 *     if (keys.isDown('KeyD')) this.host.position.x += speed;
 *   }
 * }
 * ```
 */
export abstract class AbstractWorldObjectComponent<
  TDeps = Record<string, never>,
> extends AbstractComponent<WorldObject>
  implements WorldObjectComponent<TDeps>
{
  /**
   * The {@link World} the host {@link WorldObject} lives in. Shorthand
   * for `this.host.world`.
   */
  public get world(): World {
    return this.host.world;
  }

  /**
   * The {@link Game} the host's world belongs to. Always non-null —
   * the world's `game` field is a mandatory construction argument, not
   * an option.
   */
  public get game(): Game {
    return this.host.world.game;
  }

  public onAdded(_deps: TDeps): void {}

  public onUpdate(_update: WorldUpdate, _deps: TDeps): void {}

  public onDestroy(_deps: TDeps): void {}
}
