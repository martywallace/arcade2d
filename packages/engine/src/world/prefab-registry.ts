import { ErrorCode, throwEngineError } from '../error';
import { Prefab } from './prefab';

/**
 * A name-keyed lookup table of {@link Prefab}s. The registry exists for two
 * reasons:
 *
 * 1. **Uniqueness.** Plain `Prefab` instances do not enforce name uniqueness
 *    on their own — two `new Prefab({ name: 'enemy' })` calls produce two
 *    independent prefabs. Registering them through a shared `PrefabRegistry`
 *    surfaces the collision immediately rather than letting both quietly
 *    fight over the `enemy@N` id space.
 *
 * 2. **Spawn-by-name.** When the engine eventually deserialises a world from
 *    persisted state, the saved data refers to prefabs by their `name`
 *    string, not by any in-memory reference. A registry is the canonical
 *    place to resolve those strings back to the prefab objects that know how
 *    to rebuild them.
 *
 * Registries are independent of {@link World} instances — a registry can be
 * attached to one world, shared across many, or used purely as a directory
 * lookup. Attach a registry to a world via
 * {@link WorldOptions.prefabs} to enable
 * {@link World.createFromPrefabName}.
 *
 * @example
 * ```typescript
 * const prefabs = new PrefabRegistry();
 * prefabs.register(PlayerPrefab);
 * prefabs.register(EnemyPrefab);
 *
 * const world = game.createWorld({ components: setup, prefabs });
 * world.createFromPrefabName('enemy', new Point(100, 100));
 * ```
 */
export class PrefabRegistry {
  private readonly _prefabs: Map<string, Prefab> = new Map();

  /**
   * Constructs a new registry, optionally seeded with an initial set of
   * prefabs. Equivalent to constructing an empty registry and then calling
   * {@link PrefabRegistry.register} on each entry.
   *
   * @param prefabs Initial prefabs to register. Throws if any two share a
   * name.
   */
  constructor(prefabs: readonly Prefab[] = []) {
    for (const prefab of prefabs) {
      this.register(prefab);
    }
  }

  /**
   * Registers a prefab under its own `name`. Throws if a prefab with that
   * name is already registered — replacement is intentionally not supported
   * because it almost always indicates a mistake (e.g. two modules both
   * declaring an `enemy` prefab). If you genuinely want to swap, call
   * {@link PrefabRegistry.unregister} first.
   *
   * @param prefab The prefab to register.
   */
  public register(prefab: Prefab): void {
    if (this._prefabs.has(prefab.name)) {
      throwEngineError(
        ErrorCode.PREFAB_ALREADY_REGISTERED,
        `A prefab named "${prefab.name}" is already registered.`,
        { name: prefab.name },
      );
    }

    this._prefabs.set(prefab.name, prefab);
  }

  /**
   * Removes a prefab from the registry. Returns `true` if a prefab was
   * removed, `false` if no prefab with that name existed. The prefab object
   * itself is not destroyed — it remains usable for direct
   * {@link World.createFromPrefab} calls, just no longer reachable by name
   * through this registry.
   *
   * @param name The prefab name to remove.
   */
  public unregister(name: string): boolean {
    return this._prefabs.delete(name);
  }

  /**
   * Looks up a prefab by name. Throws if no prefab is registered under that
   * name; use {@link PrefabRegistry.getNullable} when absence is a valid
   * outcome.
   *
   * @param name The prefab name to look up.
   */
  public get(name: string): Prefab {
    const prefab = this._prefabs.get(name);

    if (!prefab) {
      throwEngineError(
        ErrorCode.PREFAB_NOT_FOUND,
        `No prefab is registered under the name "${name}".`,
        { name },
      );
    }

    return prefab;
  }

  /**
   * Looks up a prefab by name. Returns `null` if no prefab is registered
   * under that name, instead of throwing.
   *
   * @param name The prefab name to look up.
   */
  public getNullable(name: string): Prefab | null {
    return this._prefabs.get(name) ?? null;
  }

  /**
   * Whether a prefab with the given name is registered.
   *
   * @param name The prefab name to check for.
   */
  public has(name: string): boolean {
    return this._prefabs.has(name);
  }

  /**
   * The number of prefabs currently registered.
   */
  public get size(): number {
    return this._prefabs.size;
  }

  /**
   * A snapshot of the names of every prefab currently registered. The array
   * is a copy — mutating it does not affect the registry.
   */
  public get names(): readonly string[] {
    return [...this._prefabs.keys()];
  }

  /**
   * A snapshot of every prefab currently registered. The array is a copy —
   * mutating it does not affect the registry, though the prefabs themselves
   * are returned by reference.
   */
  public get prefabs(): readonly Prefab[] {
    return [...this._prefabs.values()];
  }
}
