import { AbstractComponentHost, Component } from '../components';
import { Point } from '../geometry';
import { IDGenerator } from '../utils/id-generator';
import { Prefab } from './prefab';
import { Update } from './update';
import { WorldObject } from './world-object';

/**
 * Lifecycle phase in which a {@link WorldErrorContext} was produced.
 *
 * - `component-update`: a component threw during its `onUpdate`.
 * - `component-destroy`: a component threw during its `onDestroy`.
 */
export type WorldErrorPhase = 'component-update' | 'component-destroy';

/**
 * Context handed to the {@link WorldOptions.onError} handler whenever a
 * user-supplied component callback throws during the engine's update or
 * teardown.
 */
export type WorldErrorContext = {
  /**
   * Which lifecycle phase the throw came from. See {@link WorldErrorPhase}.
   */
  readonly phase: WorldErrorPhase;

  /**
   * The thrown value. Untyped because user code can throw anything.
   */
  readonly error: unknown;

  /**
   * The host the failing component was attached to — either the {@link World}
   * itself (for world-scoped components) or a {@link WorldObject}.
   */
  readonly host: World | WorldObject;

  /**
   * The key the failing component was registered under on its host.
   */
  readonly componentKey: string;
};

export type WorldOptions = {
  readonly components: (world: World) => Record<string, () => Component<World>>;

  /**
   * Optional error handler invoked whenever a component callback throws
   * during `onUpdate` or `onDestroy`. If omitted, the engine logs to
   * `console.error` and continues. Either way, the offending component
   * does not abort the rest of the tick — other components on the same
   * host, and all other hosts, keep running. This is the engine's
   * resilience contract.
   *
   * Throwing from inside the handler itself *will* propagate out of
   * {@link World.update} (and back through the engine's `finally`), giving
   * callers an opt-in path to fail-fast.
   */
  readonly onError?: (context: WorldErrorContext) => void;
};

/**
 * The root container for an arcade2d simulation. Owns the set of live
 * {@link WorldObject}s, drives the per-frame update loop, and hosts
 * world-scoped {@link Component}s (e.g. the {@link Scene} graphics component).
 *
 * ### Update phases
 *
 * Each call to {@link World.update} runs three phases in order:
 *
 * 1. **Component update.** Every world-scoped component receives `onUpdate`.
 * 2. **Object update.** Every live `WorldObject` (and transitively, its
 *    components) receives `onUpdate`. Objects that were marked destroyed
 *    earlier in the same tick are skipped — destroying an object during the
 *    component phase, or via another object earlier in the iteration, will
 *    prevent its `onUpdate` running this frame.
 * 3. **Sweep + flush.** Destroyed objects get `onDestroy` called and are
 *    removed from the live set and the id map. Objects spawned during this
 *    tick are then promoted into the live set so they participate in the
 *    *next* tick.
 *
 * Spawns that happen *during* a tick are deferred so the iteration order of
 * the object update phase stays stable: an object spawned at frame `N` does
 * not have its `onUpdate` called until frame `N+1`. The new object is,
 * however, findable via {@link World.findById} immediately on spawn so
 * callers can wire up cross-references in the same tick they created the
 * object. An object that is both spawned and destroyed within a single tick
 * never enters the live set; its `onDestroy` still runs during the sweep so
 * component cleanup is honoured.
 *
 * Spawns that happen *outside* a tick (e.g. world setup before the loop
 * starts) join the live set immediately and participate in the very next
 * tick.
 */
export class World extends AbstractComponentHost<World> {
  private _lastUpdate = 0;
  private _isUpdating = false;
  private _objects: WorldObject[] = [];
  private _pendingObjects: WorldObject[] = [];

  private readonly _mappedObjects: Map<string, WorldObject> = new Map();
  private readonly _idGenerator = new IDGenerator();
  private readonly _onError?: (context: WorldErrorContext) => void;

  constructor(options: WorldOptions) {
    super();

    this._onError = options.onError;

    this.addComponentsFromFactories(options.components(this));
  }

  /**
   * Routes a runtime component error through the configured handler, or to
   * `console.error` when no handler is supplied. Called by the engine
   * whenever a component's `onUpdate` or `onDestroy` throws. Safe to call
   * from user code too if you want to surface your own errors through the
   * same channel.
   *
   * @param context Details about the failing component and the phase it
   * was running in.
   */
  public reportError(context: WorldErrorContext): void {
    if (this._onError) {
      this._onError(context);

      return;
    }

    console.error(
      `[arcade2d] component "${context.componentKey}" threw during ${context.phase}:`,
      context.error,
    );
  }

  protected override _handleComponentDestroyError(
    error: unknown,
    key: string,
  ): void {
    this.reportError({
      phase: 'component-destroy',
      error,
      host: this,
      componentKey: key,
    });
  }

  /**
   * Creates a new world object from a target prefab.
   *
   * @param prefab The prefab to create an object from.
   * @param position The starting position of the new object in the world.
   */
  public createFromPrefab(
    prefab: Prefab,
    position = Point.zero(),
  ): WorldObject {
    const object = prefab.buildObject(this, position);

    return this.add(object);
  }

  /**
   * Creates a new empty world object. Useful for creating one-off objects that
   * don't necessarily need to be based on a prefab definition.
   *
   * @param position The starting position of the new object in the world.
   * @param tags The tags to assign to the new object.
   */
  public createEmpty(
    position = Point.zero(),
    tags?: readonly string[],
  ): WorldObject {
    const object = new WorldObject(this, position, {
      id: this._idGenerator.next(),
      tags: new Set(tags ?? []),
    });

    return this.add(object);
  }

  protected add(object: WorldObject): WorldObject {
    this._mappedObjects.set(object.metadata.id, object);

    // Outside of an update tick (e.g. setup before the loop starts), objects
    // join the live set immediately so the very first tick iterates them.
    // During a tick, spawns are deferred so iteration order stays stable.
    if (this._isUpdating) {
      this._pendingObjects.push(object);
    } else {
      this._objects.push(object);
    }

    return object;
  }

  public update(): Update {
    // Capture `now` once so the timestamp threaded into Update is the same
    // one stored as `_lastUpdate` for the next frame. Otherwise the next
    // frame's `prev` would be later than this frame's `current`, silently
    // dropping the time spent inside update() itself from the running clock.
    const now = Date.now();
    const update = new Update(this._lastUpdate, now);

    this._isUpdating = true;

    // try/finally guarantees `_isUpdating` is reset even if a component or
    // object hook throws. Without this, a single thrown error would wedge
    // every future spawn into pending forever.
    try {
      // Phase 1: component update. Each component is isolated so one
      // throwing component does not kill the rest of the world's frame.
      for (const [key, component] of this.components) {
        try {
          component.onUpdate(update);
        } catch (error) {
          this.reportError({
            phase: 'component-update',
            error,
            host: this,
            componentKey: key,
          });
        }
      }

      // Phase 2: object update. Skip anything that was destroyed earlier in
      // the tick (either by the component phase or by another object's
      // onUpdate) so a dying entity does not get one final tick after its
      // death is observable to others.
      for (const object of this._objects) {
        if (object.destroyed) {
          continue;
        }

        object.onUpdate(update);
      }

      // Phase 3a: sweep destroyed objects from the live set. We track a set
      // of the objects whose onDestroy we actually ran rather than
      // re-checking `destroyed` in the compaction pass — an onDestroy hook
      // is allowed to mark *other* objects destroyed, and those
      // re-entrantly-destroyed objects must be left in the live set so they
      // receive their own onDestroy on the next tick rather than vanishing
      // silently here.
      const swept: WorldObject[] = [];

      for (const object of this._objects) {
        if (object.destroyed) {
          object.onDestroy();
          swept.push(object);
        }
      }

      if (swept.length > 0) {
        const sweptSet = new Set(swept);

        for (const object of swept) {
          this._mappedObjects.delete(object.metadata.id);
        }

        this._objects = this._objects.filter(
          (object) => !sweptSet.has(object),
        );
      }

      // Phase 3b: flush objects spawned during this tick. An object that was
      // spawned and then destroyed within the same tick never enters the
      // live set, but we still run onDestroy so component cleanup happens.
      if (this._pendingObjects.length > 0) {
        const pending = this._pendingObjects;
        this._pendingObjects = [];

        for (const object of pending) {
          if (object.destroyed) {
            object.onDestroy();
            this._mappedObjects.delete(object.metadata.id);
          } else {
            this._objects.push(object);
          }
        }
      }
    } finally {
      this._isUpdating = false;
    }

    this._lastUpdate = now;

    return update;
  }

  /**
   * Immediately destroys the world, all of its objects (including any spawned
   * during the current tick that have not yet been flushed into the live set),
   * and any included components.
   *
   * Safe to call against objects that have already been marked destroyed but
   * not yet swept — {@link WorldObject.onDestroy} is idempotent, so cleanup
   * runs exactly once regardless of prior state.
   */
  public destroy(): void {
    for (const object of this._objects) {
      object.onDestroy();
    }

    for (const object of this._pendingObjects) {
      object.onDestroy();
    }

    this.removeAllComponents();

    this._objects = [];
    this._pendingObjects = [];
    this._mappedObjects.clear();
  }

  /**
   * Finds an object in the world using its ID. Newly spawned objects are
   * findable from the moment they are created, even before they are promoted
   * into the live iteration set at the end of the current tick.
   *
   * @param id The ID of the object to find.
   *
   * @returns The object with the given ID, or `null` if it does not exist.
   */
  public findById(id: string): WorldObject | null {
    return this._mappedObjects.get(id) ?? null;
  }

  /**
   * Finds all objects in the world with the given tag. Includes objects that
   * have just been spawned this tick and are awaiting promotion into the
   * live set, matching the same-tick visibility offered by
   * {@link World.findById}.
   *
   * @param tag The tag to find objects by.
   *
   * @returns An array of objects with the given tag.
   */
  public findByTag(tag: string): readonly WorldObject[] {
    const matches = this._objects.filter((object) =>
      object.metadata.tags.has(tag),
    );

    for (const object of this._pendingObjects) {
      if (object.metadata.tags.has(tag)) {
        matches.push(object);
      }
    }

    return matches;
  }

  /**
   * Finds a single object in the world with the given tag. Includes objects
   * that have just been spawned this tick and are awaiting promotion into
   * the live set.
   *
   * @param tag The tag to find an object by.
   *
   * @returns The first object with the given tag, or `null` if no object is
   * found.
   */
  public findOneByTag(tag: string): WorldObject | null {
    const match = this._objects.find((object) => object.metadata.tags.has(tag));

    if (match) {
      return match;
    }

    return (
      this._pendingObjects.find((object) => object.metadata.tags.has(tag)) ??
      null
    );
  }

  protected getHostReference(): World {
    return this;
  }
}
