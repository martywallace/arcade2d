import { Component, ComponentMap } from '../components';
import { ErrorCode, throwEngineError } from '../error';
import { Point } from '../geometry';
import { IDGenerator } from '../utils/id-generator';
import { PREFAB_BUILD_TOKEN, PrefabBuildToken } from './internal';
import { World } from './world';
import { WorldObject } from './world-object';

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

/**
 * A template for spawning {@link WorldObject}s with a pre-defined component
 * graph. Prefabs are the engine's primary unit of object composition: rather
 * than instantiating a world object and bolting components onto it
 * imperatively, you describe what an "enemy" or "bullet" is once via a
 * `Prefab`, then ask the {@link World} to materialise it whenever you need
 * one.
 *
 * ### Anatomy
 *
 * A prefab carries three things:
 *
 * - A `name`, which uniquely identifies it within any
 *   {@link PrefabRegistry} it is registered against and prefixes the ids of
 *   every object it spawns.
 * - An optional list of `tags` that every spawn inherits.
 * - A {@link PrefabComponentMap}: keys to factory functions that produce the
 *   object's starting components when invoked.
 *
 * Each {@link Prefab.buildObject} call walks the component map, invokes every
 * factory with the same {@link PrefabComponentContext}, then registers the
 * resulting components on the new object in a single batch. Because factories
 * run per-spawn, the components themselves are never shared between objects.
 *
 * ### Uniqueness and ids
 *
 * Object ids are minted by an internal {@link IDGenerator} keyed by the
 * prefab's `name`, so an object spawned from `enemy` is identifiable by an id
 * like `enemy@1`. The generator is **per-prefab-instance**, not per-name — if
 * you accidentally construct two `new Prefab({ name: 'enemy' })` and use them
 * both against the same world, their id streams will overlap. Register your
 * prefabs against a {@link PrefabRegistry} to make that misuse impossible.
 *
 * ### Construction
 *
 * Prefabs are designed to be constructed once at module scope and referenced
 * by every caller that wants to spawn from them:
 *
 * @example
 * ```typescript
 * export const EnemyPrefab = new Prefab({
 *   name: 'enemy',
 *   tags: ['hostile'],
 *   components: {
 *     controller: ({ object }) => new EnemyController(object),
 *     graphics: ({ object }) => PolygonGraphics.asRectangle(object, 32, 32),
 *   },
 * });
 *
 * // Elsewhere:
 * world.createFromPrefab(EnemyPrefab, new Point(100, 100));
 * ```
 */
export class Prefab {
  /**
   * Human-readable name supplied at construction. Used as the prefab's
   * identity in a {@link PrefabRegistry} and as the id prefix of spawned
   * objects.
   */
  public readonly name: string;

  /**
   * Tags every spawn from this prefab inherits. Exposed as a `readonly`
   * array purely for introspection — the actual `Set` baked into each
   * spawned object's metadata is a fresh copy per spawn.
   */
  public readonly tags: readonly string[];

  private readonly _components: PrefabComponentMap;
  private readonly _idGenerator: IDGenerator;

  constructor(options: PrefabOptions) {
    if (typeof options.name !== 'string' || options.name.trim().length === 0) {
      throwEngineError(
        ErrorCode.PREFAB_INVALID_NAME,
        'Prefab name must be a non-empty string.',
        { name: options.name },
      );
    }

    this.name = options.name;
    this.tags = options.tags ?? [];
    this._components = options.components;
    this._idGenerator = new IDGenerator({ prefix: options.name });
  }

  /**
   * The number of objects this prefab has spawned so far. Equivalent to the
   * counter behind the most recently issued id, and `0` until the first
   * {@link Prefab.buildObject} call. Useful for diagnostics and tests.
   */
  public get spawnCount(): number {
    return this._idGenerator.count;
  }

  /**
   * Materialises a new {@link WorldObject} from this prefab.
   *
   * **Engine-internal.** This method is gated by an internal token symbol;
   * callers must go through {@link World.createFromPrefab} or
   * {@link World.createFromPrefabName} instead, both of which thread the
   * token through for you. The gate exists because invoking `buildObject`
   * directly produces a fully-formed object that has _not_ been added to a
   * world — a footgun the public API avoids.
   *
   * @param token Engine-internal authorisation token. Held privately and
   * passed through by `World`.
   * @param world The world the new object will belong to.
   * @param position Starting position for the new object. Cloned by the
   * {@link WorldObject} constructor so subsequent mutations of the input do
   * not bleed into the spawned object.
   */
  public buildObject(
    token: PrefabBuildToken,
    world: World,
    position = Point.zero(),
  ): WorldObject {
    if (token !== PREFAB_BUILD_TOKEN) {
      throwEngineError(
        ErrorCode.PREFAB_BUILD_UNAUTHORIZED,
        'Prefab.buildObject is engine-internal. Use World.createFromPrefab ' +
          'or World.createFromPrefabName instead.',
        { prefabName: this.name },
      );
    }

    const object = new WorldObject(world, position, {
      id: this._idGenerator.next(),
      prefabName: this.name,
      tags: new Set(this.tags),
    });

    const context: PrefabComponentContext = { world, object };
    const componentMap: ComponentMap<WorldObject> = Object.fromEntries(
      Object.entries(this._components).map(
        ([key, factory]) => [key, factory(context)] as const,
      ),
    );

    object.addComponents(componentMap);

    return object;
  }
}
