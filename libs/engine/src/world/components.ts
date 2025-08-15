import { ErrorCode, throwEngineError } from '../error';
import { Update } from './update';

/**
 * Defines a component that can be added to a a host object.
 *
 * @template THost - The type of the host object.
 */
export interface Component<THost> {
  /**
   * The host object that this component is attached to.
   */
  readonly host: THost;

  /**
   * Lifecycle hook that is called when the component is added to the host
   * object. Should not be called directly.
   */
  onAdded(): void;

  /**
   * Lifecycle hook that is called when the host object is updated. Should not
   * be called directly.
   *
   * @param update The `Update` instance containing metadata about the world
   * update that triggered this component to update.
   */
  onUpdate(update: Update): void;

  /**
   * Lifecycle hook that is called when the host object is destroyed. Should
   * not be called directly.
   */
  onDestroy(): void;
}

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
   * Gets a component from the host object using its type. Throws if the
   * component does not exist. If there are multiple components of the same
   * type, the earliest registered component is returned, although you should
   * treat this as non-deterministic from a mental modelling standpoint.
   *
   * Performs an O(n) lookup once per type initially, then caches the resolved
   * key and performs an O(1) lookup thereafter.
   *
   * @param type The type of the component to get.
   */
  getComponentByType<T extends Component<THost>>(
    type: ComponentHostConstructor<T>,
  ): T;

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
   * the component does not exist, rather than throwing an error.
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

export type ComponentHostConstructor<T> = new (...args: any[]) => T;
export type ComponentFactory<THost extends ComponentHost<THost>> = (
  host: THost,
) => Component<THost>;
export type ComponentMap<THost extends ComponentHost<THost>> = Record<
  string,
  Component<THost>
>;
export type ComponentFactoryMap<THost extends ComponentHost<THost>> = Record<
  string,
  ComponentFactory<THost>
>;

/**
 * Abstract base class for component hosts able to extend their own base class.
 * Implements the `ComponentHost` interface with behaviour aligned to the
 * documentation of those methods.
 */
export abstract class AbstractComponentHost<THost extends ComponentHost<THost>>
  implements ComponentHost<THost>
{
  protected readonly components = new Map<string, Component<THost>>();

  private readonly _componentByTypeCache = new Map<Function, string>();

  public addComponent(
    key: string,
    component: Component<THost>,
    options: AddComponentOptions = {},
  ): Component<THost> {
    return this.addComponents({ [key]: component }, options)[key];
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
    // Register all incoming components first.
    for (const [key, component] of Object.entries(components)) {
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
    }

    // Then call the onAdded() lifecycle hook on all of them.
    for (const component of Object.values(components)) {
      component.onAdded();
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

    for (const [key, component] of this.components) {
      if (component instanceof type) {
        this._componentByTypeCache.set(type, key);
        return component;
      }
    }

    throwEngineError(
      ErrorCode.COMPONENT_NOT_FOUND,
      `Component type not found: ${type.name}`,
      {
        type,
        host: this,
      },
    );
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
    return this.getNullableComponentByType(type) !== null;
  }

  public removeComponent(key: string): void {
    const component = this.getNullableComponent(key);

    if (component) {
      component.onDestroy();

      this.components.delete(key);

      for (const [ref, componentKey] of this._componentByTypeCache) {
        if (componentKey === key) {
          this._componentByTypeCache.delete(ref);
        }
      }
    }
  }

  public removeAllComponents(): void {
    for (const [_, component] of this.components) {
      component.onDestroy();
    }

    this.components.clear();
    this._componentByTypeCache.clear();
  }

  /**
   * Gets a reference to the host object that this component is attached to.
   * Required for the compiler to be able to resolve the type of the host object
   * correctly in some internal function calls (e.g. when resolving the type of
   * the host object from a factory function).
   */
  protected abstract getHostReference(): THost;
}
