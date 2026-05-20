import { ErrorCode } from './error.constants';
import { throwEngineError } from './error.support';
import type {
  AddComponentOptions,
  Component,
  ComponentFactory,
  ComponentFactoryMap,
  ComponentHost,
  ComponentHostConstructor,
  ComponentMap,
} from './components.types';

/**
 * Sentinel "empty deps" object used for components that don't implement
 * `resolveDependencies`. Frozen so a misbehaving component can't mutate
 * the shared instance.
 *
 * @internal
 */
const EMPTY_DEPS: Readonly<Record<string, never>> = Object.freeze({});

/**
 * Internal duck-typed shape used to detect whether a component opts into
 * the dependency-resolution lifecycle. Kept off the public
 * {@link Component} interface because the resolver type depends on the
 * host kind, which the structural primitive cannot express.
 *
 * @internal
 */
type ComponentWithResolveDependencies = {
  resolveDependencies?: (resolver: unknown) => unknown;
};

/**
 * Returns the component's `resolveDependencies` method if it implements
 * one, or `null` otherwise. Used by the engine to detect whether to enter
 * the resolve phase for a given component.
 *
 * @internal
 */
function getResolveDependenciesFn(
  component: unknown,
): ((resolver: unknown) => unknown) | null {
  const candidate = (component as ComponentWithResolveDependencies)
    .resolveDependencies;

  return typeof candidate === 'function' ? candidate : null;
}

/**
 * Abstract base class for component hosts able to extend their own base class.
 * Implements the `ComponentHost` interface with behaviour aligned to the
 * documentation of those methods.
 */
export abstract class AbstractComponentHost<
  THost extends ComponentHost<THost>,
> implements ComponentHost<THost> {
  /**
   * Master gate on every component update phase this host runs. When
   * `false`, the host's `onPreUpdate`, `onUpdate`, and `onPostUpdate`
   * iterations short-circuit at a single check — useful for freezing a
   * single object during a cutscene, pausing a UI widget while a menu is
   * up, or temporarily disabling a debug overlay without tearing the
   * components down.
   *
   * The flag is **not** propagated to `onAdded` or `onDestroy`. Those
   * always fire so a host can never end up with half-attached components,
   * and a disabled object is still cleanly torn down when destroyed.
   *
   * Defaults to `true` (active). Flip back to `true` and the host resumes
   * ticking from its preserved state on the next world `update()`.
   */
  public enabled = true;

  protected readonly components = new Map<string, Component<THost>>();

  /**
   * Resolved dependencies cached per component. Populated during
   * {@link AbstractComponentHost.addComponents} from the return value of
   * each component's `resolveDependencies` method, and threaded into every
   * lifecycle hook for the remainder of that component's lifetime on this
   * host. Components without dependencies map to the shared
   * {@link EMPTY_DEPS} sentinel so the lookup path stays uniform.
   */
  private readonly _depsByComponent = new Map<Component<THost>, unknown>();

  /**
   * Flag set while a component's `resolveDependencies` is running. Used to
   * detect re-entrant `addComponent` calls and reject them with
   * {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_REENTRANT} — the engine
   * does not allow new components to land on a host mid-resolve.
   */
  private _isResolvingDependencies = false;

  private readonly _componentByTypeCache = new Map<
    ComponentHostConstructor<Component<THost>>,
    string
  >();

  public addComponent(
    key: string,
    component: Component<THost>,
    options: AddComponentOptions = {},
  ): Component<THost> {
    this.addComponents({ [key]: component }, options);

    return component;
  }

  public addComponentFromFactory(
    key: string,
    factory: ComponentFactory<THost>,
    options: AddComponentOptions = {},
  ): Component<THost> {
    return this.addComponent(key, factory(this.getHostReference()), options);
  }

  public addComponents(
    components: ComponentMap<THost>,
    { allowReplacement = false }: AddComponentOptions = {},
  ): ComponentMap<THost> {
    // Re-entrancy guard. A component's `resolveDependencies` must not call
    // back into addComponent — that would mean inspecting the host mid-resolve
    // when only some components are registered, which is impossible to
    // reason about cleanly.
    if (this._isResolvingDependencies) {
      throwEngineError(
        ErrorCode.WORLD_COMPONENT_DEPENDENCY_REENTRANT,
        'Cannot add components from inside resolveDependencies. Register all ' +
          'components in advance and let the resolver discover them.',
        { host: this },
      );
    }

    const entries = Object.entries(components);

    // Stage 1: register every component. Siblings must already be in the
    // map by the time we enter the resolve phase so that `requireSibling`
    // and friends can see them. Track the keys we added in this batch so
    // we can roll back atomically if resolve fails.
    const addedKeys: string[] = [];

    for (const [key, component] of entries) {
      if (this.components.has(key)) {
        if (allowReplacement) {
          this.removeComponent(key);
        } else {
          throwEngineError(
            ErrorCode.COMPONENT_ALREADY_EXISTS,
            `The component ${key} already exists.`,
            { key, host: this },
          );
        }
      }

      this.components.set(key, component);
      addedKeys.push(key);
    }

    // Stage 2: resolve dependencies. On failure, undo every registration
    // from this batch so the host doesn't end up holding components whose
    // `onAdded` was never called. Components added via `allowReplacement`
    // can't fully restore their predecessor (the old component already had
    // `onDestroy` invoked during `removeComponent`), but the failing batch
    // itself does roll back.
    this._isResolvingDependencies = true;
    try {
      for (const [key, component] of entries) {
        const resolveFn = getResolveDependenciesFn(component);

        if (!resolveFn) {
          this._depsByComponent.set(component, EMPTY_DEPS);
          continue;
        }

        const resolver = this._createDependencyResolver(component, key);
        const deps = resolveFn.call(component, resolver);
        this._depsByComponent.set(component, deps);
      }
    } catch (error) {
      for (const key of addedKeys) {
        const component = this.components.get(key);
        this.components.delete(key);

        if (component) {
          this._depsByComponent.delete(component);
        }
      }

      this._isResolvingDependencies = false;
      throw error;
    }
    this._isResolvingDependencies = false;

    // Stage 3: call onAdded on each component. By this point all
    // dependencies are resolved and cached, so any cross-component
    // references (whether declared via resolveDependencies or fetched
    // ad-hoc via `host.getComponent`) work as advertised.
    for (const component of Object.values(components)) {
      const deps = this._depsByComponent.get(component) ?? EMPTY_DEPS;
      component.onAdded(deps);
    }

    return components;
  }

  public addComponentsFromFactories(
    map: ComponentFactoryMap<THost>,
    options?: AddComponentOptions,
  ): ComponentMap<THost> {
    const componentMap = Object.fromEntries(
      Object.entries(map).map(
        ([key, factory]) => [key, factory(this.getHostReference())] as const,
      ),
    );

    this.addComponents(componentMap, options);

    return componentMap;
  }

  public getComponent<T extends Component<THost>>(key: string): T {
    const value = this.components.get(key);

    if (!value) {
      throwEngineError(
        ErrorCode.COMPONENT_NOT_FOUND,
        `The component ${key} does not exist.`,
        {
          key,
          host: this,
        },
      );
    }

    return value as T;
  }

  public getComponentByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): T {
    const cachedKey = this._componentByTypeCache.get(type);

    if (cachedKey) {
      return this.getComponent(cachedKey);
    }

    // Walk all entries first so we can spot ambiguity rather than silently
    // returning the first match. The cache is only populated when the
    // lookup is unambiguous, so the next call can take the fast path.
    let matchedKey: string | null = null;
    let matchedComponent: Component<THost> | null = null;

    for (const [key, component] of this.components) {
      if (component instanceof type) {
        if (matchedKey !== null) {
          throwEngineError(
            ErrorCode.COMPONENT_AMBIGUOUS_TYPE,
            `Multiple components of type ${type.name} are registered on ` +
              `this host. Use getComponentsByType() to retrieve them all, ` +
              `or look up by key.`,
            { type, host: this },
          );
        }

        matchedKey = key;
        matchedComponent = component;
      }
    }

    if (matchedKey === null || matchedComponent === null) {
      throwEngineError(
        ErrorCode.COMPONENT_NOT_FOUND,
        `Component type not found: ${type.name}`,
        {
          type,
          host: this,
        },
      );
    }

    this._componentByTypeCache.set(type, matchedKey);

    return matchedComponent as T;
  }

  public getComponentsByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): readonly T[] {
    const matches: T[] = [];

    for (const component of this.components.values()) {
      if (component instanceof type) {
        matches.push(component);
      }
    }

    return matches;
  }

  public getNullableComponent<T extends Component<THost>>(
    key: string,
  ): T | null {
    try {
      return this.getComponent<T>(key);
    } catch {
      return null;
    }
  }

  public getNullableComponentByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): T | null {
    try {
      return this.getComponentByType<T>(type);
    } catch {
      return null;
    }
  }

  public hasComponent(key: string): boolean {
    return this.components.has(key);
  }

  public hasComponentByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): boolean {
    // Don't delegate to getNullableComponentByType — that returns null both
    // when the type is missing AND when the lookup is ambiguous, which
    // would make hasComponentByType lie about a host that has *multiple*
    // components of the type.
    for (const component of this.components.values()) {
      if (component instanceof type) {
        return true;
      }
    }

    return false;
  }

  public removeComponent(key: string): void {
    const component = this.getNullableComponent(key);

    if (component) {
      const deps = this._depsByComponent.get(component) ?? EMPTY_DEPS;
      component.onDestroy(deps);

      this.components.delete(key);
      this._depsByComponent.delete(component);

      for (const [ref, componentKey] of this._componentByTypeCache) {
        if (componentKey === key) {
          this._componentByTypeCache.delete(ref);
        }
      }
    }
  }

  public removeAllComponents(): void {
    // Snapshot first so siblings remain reachable to each other during
    // onDestroy (the documented teardown contract), and so that a throwing
    // onDestroy cannot leave `components` half-populated.
    const snapshot = [...this.components];

    for (const [key, component] of snapshot) {
      const deps = this._depsByComponent.get(component) ?? EMPTY_DEPS;
      try {
        component.onDestroy(deps);
      } catch (error) {
        this._handleComponentDestroyError(error, key);
      }
    }

    this.components.clear();
    this._depsByComponent.clear();
    this._componentByTypeCache.clear();
  }

  /**
   * Hook for subclasses to intercept errors thrown by a component's
   * `onDestroy` during {@link AbstractComponentHost.removeAllComponents}.
   * Default behaviour is to log and swallow — a single bad component must
   * not prevent the rest of the host's components from being torn down.
   * Subclasses may override to route errors through their own reporting
   * channel.
   *
   * @param error The thrown error.
   * @param key The key of the component that threw.
   */
  protected _handleComponentDestroyError(error: unknown, key: string): void {
    console.error(
      `[arcade2d] component "${key}" threw during onDestroy:`,
      error,
    );
  }

  /**
   * Gets a reference to the host object that this component is attached to.
   * Required for the compiler to be able to resolve the type of the host object
   * correctly in some internal function calls (e.g. when resolving the type of
   * the host object from a factory function).
   */
  protected abstract getHostReference(): THost;

  /**
   * Subclass hook that produces the concrete dependency resolver the host
   * hands to a component's `resolveDependencies`. The {@link World} hosts a
   * resolver scoped to siblings only; a {@link WorldObject} hosts one that
   * also exposes cross-tier lookups against the parent world.
   *
   * Engine-internal — never called by user code.
   *
   * @param component The component about to resolve its dependencies.
   * @param key The key the component is being registered under.
   */
  protected abstract _createDependencyResolver(
    component: Component<THost>,
    key: string,
  ): unknown;

  /**
   * Internal accessor used by host iteration code (the {@link World}'s
   * per-phase loops, the per-{@link WorldObject} phase loops) to fetch the
   * cached deps for a component. Returns the shared empty-deps sentinel
   * for components that didn't opt into the dependency-resolution
   * lifecycle.
   *
   * @internal
   */
  public _getDepsFor(component: Component<THost>): unknown {
    return this._depsByComponent.get(component) ?? EMPTY_DEPS;
  }
}
