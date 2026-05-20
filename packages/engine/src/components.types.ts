import type { WorldUpdate } from './world/world-update';

/**
 * Defines a component that can be added to a host object.
 *
 * `Component<THost>` is the **structural primitive** — the lowest-level
 * shape the engine recognises. For most game code you'll reach for one of
 * the named specialisations instead:
 *
 * - {@link WorldComponent} — a component attached to the {@link World}
 *   itself (input samplers, physics broadphases, rendering systems,
 *   audio mixers).
 * - {@link WorldObjectComponent} — a component attached to a
 *   {@link WorldObject} (controllers, graphics, colliders, behaviour
 *   logic).
 *
 * Those specialisations layer on a typed
 * {@link WorldComponent.resolveDependencies resolveDependencies} method
 * and a richer dependency-aware lifecycle on top of this primitive.
 *
 * ### Update phases
 *
 * Each world tick runs three update phases in order, and every component on
 * every host is offered each phase before any host advances to the next:
 *
 * 1. **`onPreUpdate`** — sample/prepare state that downstream components
 *    will consume. Good places for input polling, per-frame buffer clears,
 *    or interpolation snapshots.
 * 2. **`onUpdate`** — the main per-frame work: behaviour logic, movement,
 *    simulation. This is the phase that the majority of components will
 *    implement.
 * 3. **`onPostUpdate`** — react to the result of everyone else's
 *    `onUpdate`. Canonical use case: a camera reading the player's
 *    *already-moved* position, or a graphics component syncing its
 *    transform from the host position one final time so it never lags by a
 *    frame.
 *
 * Within a single phase, world-scoped components run before object-scoped
 * components — see `World.update` for the full schedule. All three update
 * hooks are skipped on components whose {@link Component.enabled} field is
 * explicitly `false`.
 *
 * `onPreUpdate` and `onPostUpdate` are optional — a component that only
 * needs the main phase can omit them and the engine will skip them at zero
 * cost. `onUpdate`, `onAdded`, and `onDestroy` are required so the engine
 * can rely on them being callable.
 *
 * ### Dependencies
 *
 * Every lifecycle hook receives a `deps` argument carrying the
 * dependencies declared by the component's optional `resolveDependencies`
 * method. Components with no dependencies see an empty object and almost
 * always omit the parameter at their hook signatures — TypeScript allows
 * dropping trailing parameters when implementing the interface. Components
 * that *do* declare dependencies should reach for {@link WorldComponent}
 * or {@link WorldObjectComponent} so the deps parameter is properly typed
 * everywhere it appears.
 *
 * @template THost The type of the host object.
 * @template TDeps The shape of the resolved dependencies threaded into
 * every lifecycle hook. Defaults to `unknown` on the primitive type;
 * specialisations narrow it to the actual return shape of their
 * `resolveDependencies`.
 */
export interface Component<THost, TDeps = unknown> {
  /**
   * The host object that this component is attached to.
   */
  readonly host: THost;

  /**
   * Optional gate on the three update hooks (`onPreUpdate`, `onUpdate`,
   * `onPostUpdate`). When explicitly `false`, the engine skips all three
   * for this component during the world tick — useful for temporarily
   * pausing behaviour (e.g. a freeze powerup) without removing the
   * component and losing its internal state.
   *
   * Absent or `true` means "active." The flag does **not** gate
   * `onAdded`/`onDestroy`; those always fire so the host can never end up
   * with a half-attached component.
   */
  enabled?: boolean;

  /**
   * Lifecycle hook that is called when the component is added to the host
   * object. Should not be called directly.
   *
   * @param deps The resolved dependencies for this component, as returned
   * by `resolveDependencies`. An empty object for components that don't
   * declare dependencies.
   */
  onAdded(deps: TDeps): void;

  /**
   * Optional lifecycle hook for the **pre-update** phase. Called once per
   * world tick, before any component on any host has its `onUpdate`
   * called. Use for state preparation work that other components'
   * `onUpdate` will read.
   *
   * @param update The {@link WorldUpdate} instance for this tick.
   * @param deps The resolved dependencies for this component.
   */
  onPreUpdate?(update: WorldUpdate, deps: TDeps): void;

  /**
   * Lifecycle hook for the **main update** phase. Called once per world
   * tick, after every component's `onPreUpdate` and before any
   * `onPostUpdate`.
   *
   * @param update The {@link WorldUpdate} instance for this tick.
   * @param deps The resolved dependencies for this component.
   */
  onUpdate(update: WorldUpdate, deps: TDeps): void;

  /**
   * Optional lifecycle hook for the **post-update** phase. Called once per
   * world tick, after every component's `onUpdate` has run. Use for work
   * that has to observe the world *after* this tick's behaviour has been
   * applied — camera follow, transform sync, late-frame audit logs.
   *
   * @param update The {@link WorldUpdate} instance for this tick.
   * @param deps The resolved dependencies for this component.
   */
  onPostUpdate?(update: WorldUpdate, deps: TDeps): void;

  /**
   * Lifecycle hook that is called when the host object is destroyed. Should
   * not be called directly.
   *
   * @param deps The resolved dependencies for this component.
   */
  onDestroy(deps: TDeps): void;
}

/**
 * Options accepted by {@link ComponentHost.addComponent} and its multi-add
 * siblings. Pulled into its own type so future knobs can be added without
 * widening the call signature.
 */
export type AddComponentOptions = {
  /**
   * If true, allows replacement of an existing component with the same key.
   * The replacement process first calls `removeComponent()` on the existing
   * entry, then `addComponent()` for the new.
   */
  readonly allowReplacement?: boolean;
};

/**
 * Defines an object that can host components.
 *
 * @template THost The type of the host object.
 */
export interface ComponentHost<THost extends ComponentHost<THost>> {
  /**
   * Adds a new component to the host object. Throws if a component with the
   * specified key already exists. Calls `onAdded()` on the component once
   * registered with its host.
   *
   * @param key The key to add the component under.
   * @param component The component to add.
   * @param options Optional options for the addition process.
   */
  addComponent(
    key: string,
    component: Component<THost>,
    options?: AddComponentOptions,
  ): Component<THost>;

  /**
   * Adds a new component to the host object using a factory function.
   * Internally produces the new component using the factory function, then
   * calls `addComponent()` with the result.
   *
   * The advantage of using this method over `addComponent()` is that the
   * factory function is provided with the host.
   *
   * @param key The key to add the component under.
   * @param factory The factory function to use to create the component.
   * @param options Optional options for the addition process.
   */
  addComponentFromFactory(
    key: string,
    factory: ComponentFactory<THost>,
    options?: AddComponentOptions,
  ): Component<THost>;

  /**
   * Adds a new set of components to the host object. Throws if a component with
   * the specified key already exists. Calls `onAdded()` on each component
   * _after they are all registered with the host_, rather than one by one.
   * This is important for components that may want to reference each other
   * during the addition phase via `host.getComponent()` or similar methods.
   *
   * It is recommended to use this method rather than `addComponent()` in
   * situations like initialization of a new host object.
   *
   * @param components The components to add.
   * @param options Optional options for the addition process.
   */
  addComponents(
    components: ComponentMap<THost>,
    options?: AddComponentOptions,
  ): ComponentMap<THost>;

  /**
   * Adds a new set of components to the host object based on an input map of
   * component keys to factory functions. Behavious is equivalent to
   * `addComponents()` using the key and output of each factory function.
   *
   * @param map The map of component keys to factory functions.
   * @param options Optional options for the addition process.
   */
  addComponentsFromFactories(
    map: ComponentFactoryMap<THost>,
    options?: AddComponentOptions,
  ): ComponentMap<THost>;

  /**
   * Gets a component from the host object using the key it was registered with.
   * Throws if the component does not exist. Performs an efficient lookup on a
   * local `Map` instance.
   *
   * @param key The key of the component to get.
   */
  getComponent<T extends Component<THost>>(key: string): T;

  /**
   * Gets a component from the host object using its type. Throws if no
   * component of the type exists, or if more than one component of the type
   * exists — in the multi-match case, `getComponentByType` deliberately
   * does not pick one for you. Use {@link ComponentHost.getComponentsByType}
   * when you genuinely expect multiple matches, or look the component up by
   * its string key.
   *
   * Performs an O(n) lookup once per type initially, then caches the resolved
   * key for O(1) lookups on subsequent calls. The cache is invalidated
   * whenever a component is removed.
   *
   * @param type The type of the component to get.
   */
  getComponentByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): T;

  /**
   * Gets every component on the host of the given type, in the order they
   * were originally registered. Returns an empty array if no components
   * match.
   *
   * Unlike {@link ComponentHost.getComponentByType}, this method never
   * throws on multiplicity — it is the explicit "I expect more than one"
   * accessor.
   *
   * @param type The type of the components to get.
   */
  getComponentsByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): readonly T[];

  /**
   * Gets a component from the host object using the key it was registered with.
   * Returns `null` if the component does not exist, rather than throwing an
   * error. Useful for referencing transient or optional components without
   * manually handling errors.
   *
   * @param key The key of the component to get.
   */
  getNullableComponent<T extends Component<THost>>(key: string): T | null;

  /**
   * Gets a component from the host object using its type. Returns `null` if
   * the component does not exist or if more than one component of the type
   * is registered (i.e. the lookup is ambiguous) — the nullable variant
   * collapses both "not found" and "ambiguous" into a single `null`. Use
   * {@link ComponentHost.getComponentsByType} when you need to distinguish
   * them.
   *
   * @param type The type of the component to get.
   */
  getNullableComponentByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): T | null;

  /**
   * Checks if the host object has a component with the specified key.
   *
   * @param key The key of the component to check for.
   */
  hasComponent(key: string): boolean;

  /**
   * Checks if the host object has a component with the specified type.
   *
   * @param type The type of the component to check for.
   */
  hasComponentByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): boolean;

  /**
   * Removes a component from the host object. Care should be taken when
   * manually removing components, as methods like `getComponent()` will throw
   * if components do not exist. Removal is idempotent and will do nothing if
   * the component does not exist i.e. was already removed, or never existed.
   *
   * @param key The key of the component to remove.
   */
  removeComponent(key: string): void;

  /**
   * Removes all components from the host object. Typically called internally
   * when the lifecycle of the host object is terminated. Differs from
   * individually removing components in that it first calls `onDestroy()` on
   * each component, then removes references from the host object in a separate
   * step. This allows cleaner teardown of components that may reference each
   * other.
   */
  removeAllComponents(): void;
}

/**
 * Newable type used by `getComponentByType` / `hasComponentByType` / etc.
 * Accepts any constructor that produces a `T` — the engine never invokes
 * it, it's used purely as an `instanceof` discriminator.
 */
export type ComponentHostConstructor<T> = new (...args: never[]) => T;

/**
 * Factory function shape consumed by `addComponentFromFactory` and
 * `addComponentsFromFactories`. The host is passed in so the factory can
 * construct a component with the correct back-reference without the caller
 * having to thread the host through manually.
 */
export type ComponentFactory<THost extends ComponentHost<THost>> = (
  host: THost,
) => Component<THost>;

/**
 * Plain map of component key → component used by the multi-add APIs and
 * returned from `addComponents` so callers can grab refs to what they
 * registered without a follow-up `getComponent` call.
 */
export type ComponentMap<THost extends ComponentHost<THost>> = Record<
  string,
  Component<THost>
>;

/**
 * Plain map of component key → component factory consumed by
 * `addComponentsFromFactories`. Each factory is invoked with the host
 * during registration.
 */
export type ComponentFactoryMap<THost extends ComponentHost<THost>> = Record<
  string,
  ComponentFactory<THost>
>;
