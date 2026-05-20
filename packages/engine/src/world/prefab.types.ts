import type { Component } from '../components.types';
import type { PREFAB_BUILD_TOKEN } from './prefab.constants';
import type { World } from './world';
import type { WorldObject } from './world-object';

/**
 * Compile-time type of the {@link PREFAB_BUILD_TOKEN} symbol. Exposed so
 * engine internals can take the token as a parameter without losing the
 * `unique symbol` identity that gates the runtime check.
 *
 * @internal
 */
export type PrefabBuildToken = typeof PREFAB_BUILD_TOKEN;

/**
 * Context handed to each {@link PrefabComponentFactory} when a prefab is
 * materialised into a concrete object. Carries both the world the object is
 * being added to and a reference to the (still empty) {@link WorldObject}
 * itself, so factories can construct components that close over either.
 */
export type PrefabComponentContext = {
  /**
   * The {@link World} the new object is being created in.
   */
  readonly world: World;

  /**
   * The {@link WorldObject} being created from this prefab. The object exists
   * but has not yet had its components attached at the time the factory is
   * invoked — every factory in the prefab's map runs against the same object
   * reference, and `onAdded` fires on all of them once the full batch has been
   * registered.
   */
  readonly object: WorldObject;
};

/**
 * A function that produces a single component for a freshly-built prefab
 * instance. The factory is called exactly once per {@link Prefab.buildObject}
 * call, so each spawn gets its own component instances with no shared state.
 */
export type PrefabComponentFactory = (
  context: PrefabComponentContext,
) => Component<WorldObject>;

/**
 * Map of component keys to factory functions, describing the starting
 * component graph of any object built from a {@link Prefab}.
 */
export type PrefabComponentMap = Record<string, PrefabComponentFactory>;

/**
 * Options accepted by the {@link Prefab} constructor.
 */
export type PrefabOptions = {
  /**
   * Human-readable identifier for the prefab. Used as the prefix for ids of
   * objects spawned from this prefab (e.g. `enemy@1`, `enemy@2`) and as the
   * key when registering against a {@link PrefabRegistry}.
   *
   * Must be a non-empty string. Whitespace-only names are rejected — they make
   * grepping logs ambiguous and offer no useful disambiguation.
   */
  readonly name: string;

  /**
   * Optional set of tags that every object built from this prefab will be
   * tagged with. Tags are copied into a fresh `Set` per spawn, so callers can
   * later mutate the prefab's tag list without affecting already-spawned
   * objects (and vice versa).
   */
  readonly tags?: readonly string[];

  /**
   * Declarative description of the starting components for objects built from
   * this prefab. Each entry's factory receives a fresh
   * {@link PrefabComponentContext} at spawn time so it can wire components to
   * the host object (and, if needed, the world).
   *
   * All factories are invoked first, then their products are registered with
   * the host in a single batch via {@link ComponentHost.addComponents}. This
   * means components are allowed to reference each other inside their
   * `onAdded` hook — every sibling is reachable through `host.getComponent`
   * by the time `onAdded` runs.
   */
  readonly components: PrefabComponentMap;
};
