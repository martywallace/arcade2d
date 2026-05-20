import { AbstractComponentHost, Component } from '../components';
import { ErrorCode, throwEngineError } from '../error';
import { Point } from '../geometry';
import type { MouseState } from '../input/mouse';
import { IDGenerator } from '../utils/id-generator';
import { Camera } from './camera';
import { WorldComponentDependencyResolver } from './dependencies';
import { PREFAB_BUILD_TOKEN } from './internal';
import { Prefab } from './prefab';
import { PrefabRegistry } from './prefab-registry';
import { WorldUpdate } from './update';
import { WorldObject } from './world-object';

/**
 * Lifecycle phase in which a {@link WorldErrorContext} was produced.
 *
 * - `component-pre-update`: a component threw during its `onPreUpdate`.
 * - `component-update`: a component threw during its `onUpdate`.
 * - `component-post-update`: a component threw during its `onPostUpdate`.
 * - `component-destroy`: a component threw during its `onDestroy`.
 */
export type WorldErrorPhase =
  | 'component-pre-update'
  | 'component-update'
  | 'component-post-update'
  | 'component-destroy';

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

/**
 * Reserved component key used by the engine to register the auto-attached
 * {@link Camera} on every {@link World}. Surfaces as a constant so user
 * code that — for whatever reason — needs to introspect the camera by key
 * doesn't have to hard-code a magic string, and so the collision message
 * in `addComponents` can mention the constant rather than a raw literal.
 */
export const CAMERA_COMPONENT_KEY = 'camera';

/**
 * Reserved component key used by {@link bootstrap} (and by callers writing
 * their own bootstrap) to register the world's mouse input sampler. The
 * matching component implements `getState(): MouseState`; see the input
 * module's `Mouse` class. {@link World.getMouseState} looks up this exact
 * key.
 */
export const MOUSE_COMPONENT_KEY = 'mouse';

/**
 * Internal structural type used by {@link World.getMouseState} to look up
 * the mouse component without taking a value-level dependency on the
 * `Mouse` class itself (which lives in the `input/` module and would
 * otherwise create an avoidable import cycle with the world tier).
 *
 * @internal
 */
type MouseStateProvider = Component<World> & {
  getState(): MouseState;
};

export type WorldOptions = {
  /**
   * Factory map of world-scoped components to register on this world. Run
   * after the engine's own auto-attached components, so the user's
   * components see the {@link Camera} (and any future auto-attached
   * infrastructure) as already-resolvable siblings.
   *
   * The key {@link CAMERA_COMPONENT_KEY} is reserved by the engine —
   * attempting to register a component under that key will throw
   * {@link ErrorCode.COMPONENT_ALREADY_EXISTS}.
   */
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

  /**
   * Optional {@link PrefabRegistry} that the world can resolve prefabs
   * against by name. Required for {@link World.createFromPrefabName}.
   *
   * The same registry instance may be shared across multiple worlds —
   * registries are pure lookup tables and do not retain per-world state.
   * {@link World.createFromPrefab} (taking a `Prefab` directly) works
   * regardless of whether a registry is attached.
   */
  readonly prefabs?: PrefabRegistry;
};

/**
 * The root container for an arcade2d simulation. A `World` owns the set of
 * live {@link WorldObject}s, drives the per-frame update loop that animates
 * them, and itself hosts world-scoped {@link Component}s — i.e. components
 * that conceptually belong to the simulation as a whole rather than to any
 * single object (a {@link Scene} graphics root, a physics broadphase, an
 * input sampler, an audio mixer, and so on). It also optionally resolves
 * named prefab lookups against a {@link PrefabRegistry} passed at
 * construction.
 *
 * The class is designed so a typical game's "main loop" is one line:
 * construct the world, then call {@link World.update} once per animation
 * frame. Everything else — when components run, what order they run in,
 * how spawns/destroys interact with the running tick — is the
 * responsibility of this class and is described below.
 *
 * ## The update tick
 *
 * Each call to {@link World.update} executes the following schedule, in
 * this exact order. Understanding the schedule is the single most
 * important thing about working with arcade2d, because everything else
 * (spawn semantics, destroy semantics, cross-component wiring, ordering
 * pitfalls) is downstream of it.
 *
 * ```
 * ┌──────────────────────────────────────────────────────────────────┐
 * │ Phase 1 — Pre-update                                             │
 * │   1a. World components, in insertion order, call `onPreUpdate`   │
 * │   1b. Each live WorldObject, in spawn order, has every component │
 * │       (in component insertion order) call `onPreUpdate`          │
 * ├──────────────────────────────────────────────────────────────────┤
 * │ Phase 2 — Update                                                 │
 * │   2a. World components, in insertion order, call `onUpdate`      │
 * │   2b. Each live WorldObject, in spawn order, has every component │
 * │       (in component insertion order) call `onUpdate`             │
 * ├──────────────────────────────────────────────────────────────────┤
 * │ Phase 3 — Post-update                                            │
 * │   3a. World components, in insertion order, call `onPostUpdate`  │
 * │   3b. Each live WorldObject, in spawn order, has every component │
 * │       (in component insertion order) call `onPostUpdate`         │
 * ├──────────────────────────────────────────────────────────────────┤
 * │ Phase 4 — Sweep + flush                                          │
 * │   4a. Run `onDestroy` on every object marked destroyed this tick │
 * │       (or earlier) and remove them from the live set + id map    │
 * │   4b. Promote objects spawned mid-tick into the live set so they │
 * │       participate in the *next* tick                             │
 * └──────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ### Two ordering rules that follow from the schedule
 *
 * 1. **Phases are strict.** Every component on every host finishes its
 *    `onPreUpdate` before *any* component anywhere starts `onUpdate`.
 *    Every `onUpdate` finishes before *any* `onPostUpdate` starts. This
 *    is the contract you rely on to make camera-follows-player and
 *    similar "I need everyone else's results" patterns work without race
 *    conditions.
 *
 * 2. **Within a phase, world components run before object components.**
 *    A world-scoped input sampler in Phase 1a will have finished polling
 *    by the time a controller component in Phase 1b reads it. A
 *    world-scoped physics step in Phase 2a will have resolved collisions
 *    by the time a per-object damage handler in Phase 2b decides what to
 *    do about them.
 *
 * Within each of those two sub-orderings (world components among
 * themselves; object components on a single host among themselves), the
 * order is **insertion order** — i.e. the order they were registered via
 * `addComponents` (or the order they appear in a {@link Prefab}'s
 * component map). There is no priority or weight system; if A must run
 * before B, register A first.
 *
 * ## Choosing the right phase
 *
 * The three update hooks aren't "early, middle, late" so much as three
 * specific roles. Picking the right one is mostly about asking *what does
 * this code need to be true when it runs?*
 *
 * ### `onPreUpdate` — sample and prepare
 *
 * Use when you produce state that other components will consume during
 * `onUpdate`. The hook is optional: components that don't have prep work
 * to do should omit it. Canonical uses:
 *
 * - **Input polling.** A world-scoped `InputSystem` reads keyboard/mouse
 *   state once per tick in `onPreUpdate` and exposes it via getters.
 *   Every controller component then queries it in `onUpdate` and sees a
 *   consistent snapshot.
 * - **Per-frame buffer clears.** A world-scoped collision broadphase
 *   clears the previous tick's overlap set in `onPreUpdate` so per-object
 *   colliders can populate it during their own `onUpdate` without
 *   stepping on the previous frame's results.
 * - **Interpolation snapshots.** A graphics component caches its
 *   pre-update transform so any other system that wants to interpolate
 *   between "before" and "after" positions during the post phase has a
 *   clean snapshot to work from.
 *
 * ### `onUpdate` — do the work
 *
 * The main per-frame body of behaviour. Required on every component —
 * even if it's empty. Use when the work doesn't depend on having seen the
 * results of everyone else's update this frame. The vast majority of
 * components only need this hook. Canonical uses:
 *
 * - **Movement and behaviour.** Controllers reading input and translating
 *   it into changes to the host's `position`, AI components evaluating
 *   their decision logic, projectile components advancing themselves.
 * - **World simulation steps.** A world-scoped physics system stepping
 *   its solver, a particle emitter advancing emission timers, a wave
 *   manager spawning enemies on a cadence.
 * - **Lifetime accounting.** A bullet decrementing its remaining
 *   lifetime and self-destructing when it hits zero.
 *
 * ### `onPostUpdate` — react to everyone else's updates
 *
 * Use when your work *requires* that every other component has finished
 * its `onUpdate` first. Optional; skip when not needed. Canonical uses:
 *
 * - **Camera follow.** A world- or object-scoped camera component reads
 *   the player's *already-moved* position in `onPostUpdate` and centres
 *   the viewport on it. If you did this in `onUpdate` and the player's
 *   controller ran later in the iteration order, you'd lag by a frame.
 * - **Transform sync to a renderer.** A graphics component copying
 *   `host.position` into a PIXI display object in `onPostUpdate`
 *   guarantees the final visual reflects every behaviour change that
 *   happened this tick, including ones from late-running components.
 * - **Late audits and assertions.** A debug overlay that needs to inspect
 *   the world's settled state, count active enemies, etc.
 *
 * ### Rule of thumb
 *
 * If the code reads state set by other components: pre-update produces,
 * update consumes, post-update reacts. If you only set state, you almost
 * certainly want `onUpdate`. If you're not sure, start with `onUpdate`
 * and move to a different phase only if you see a one-frame-lag bug.
 *
 * ## Spawn and destroy semantics
 *
 * Both spawns (`createFromPrefab`, `createFromPrefabName`,
 * `createEmpty`) and destroys ({@link WorldObject.destroy}) are
 * **deferred and re-entrancy-safe** so that running components can't
 * observe inconsistent state mid-tick.
 *
 * ### Spawning
 *
 * - **Outside a tick** (e.g. during world setup before the first
 *   `update()` call), spawned objects join the live set immediately and
 *   participate in the very next tick from Phase 1 onward.
 * - **During a tick**, spawned objects are queued and only join the live
 *   set during Phase 4b. They first participate in the *next* tick. This
 *   keeps Phase 2/3 iteration order stable even if a component spawns ten
 *   new objects mid-update.
 * - **Either way**, the new object is findable via {@link World.findById}
 *   *immediately* — the id map is updated synchronously on spawn — so
 *   cross-references in the same tick are valid even if the spawned
 *   object hasn't yet been driven by an update.
 *
 * ### Destroying
 *
 * {@link WorldObject.destroy} only *marks* the object. The real removal
 * happens in Phase 4a. Consequences:
 *
 * - **An object destroyed mid-tick is skipped for all remaining phases.**
 *   If a controller destroys itself in Phase 1, neither Phase 2 nor Phase
 *   3 will touch it. This is the "no final tick" rule and exists so
 *   destroyed objects can't observe state from *after* their own death.
 * - **`onDestroy` is idempotent.** Calling `destroy()` twice, or
 *   destroying an already-cleaned object during teardown, is a no-op.
 *   Components on a destroyed object also have their `onDestroy` run
 *   exactly once during sweep.
 * - **Spawned-and-destroyed-in-the-same-tick** objects never enter the
 *   live set but *do* receive `onDestroy` during Phase 4b, so component
 *   cleanup is honoured.
 *
 * ## Enable/disable: per-component and per-host
 *
 * Two gates control whether update hooks run, layered from most specific
 * to most general:
 *
 * 1. **Per-component** — each {@link Component} carries an optional
 *    `enabled` flag. When explicitly `false`, the engine skips that
 *    component's `onPreUpdate`, `onUpdate`, and `onPostUpdate`.
 * 2. **Per-host** — every host (the {@link World} itself, and every
 *    {@link WorldObject}) carries an {@link AbstractComponentHost.enabled}
 *    field. When `false`, *every* component on that host has all three
 *    update phases skipped at a single early-return — the cheap way to
 *    freeze an entire object during a cutscene or pause a UI widget while
 *    a menu is up. The world-level toggle gates the world's own
 *    components only; object iteration is controlled by whether
 *    `update()` is called.
 *
 * Neither gate touches `onAdded` or `onDestroy`. Both fire regardless so
 * a component is never left half-attached and a destroyed host is always
 * cleanly torn down.
 *
 * ## Error isolation
 *
 * Every component hook (`onPreUpdate`, `onUpdate`, `onPostUpdate`,
 * `onDestroy`) is wrapped in a try/catch by the engine. A thrown error in
 * one component does **not** abort the tick — the rest of the host's
 * components, and every other host, continue to run. Errors are routed
 * through {@link World.reportError}, which forwards to the optional
 * {@link WorldOptions.onError} handler (defaulting to `console.error`).
 * If you *want* fail-fast, throw from inside `onError` and the engine's
 * `try/finally` will let the exception propagate out of `update()`.
 *
 * ## Cross-references
 *
 * - {@link Component} — the per-host lifecycle interface.
 * - {@link WorldObject} — the per-object host driven by Phases 1b/2b/3b.
 * - {@link Prefab} — the declarative template used to build objects.
 * - {@link PrefabRegistry} — name-keyed prefab lookup, attachable to a
 *   world for {@link World.createFromPrefabName}.
 * - {@link WorldErrorContext} — payload handed to `onError` when a
 *   component callback throws.
 *
 * @example
 * ```typescript
 * // Bootstrap a world with an input sampler and a physics system.
 * const world = new World({
 *   components: (world) => ({
 *     // Phase 1a (pre-update) — registered first so it runs first.
 *     input: () => new InputSystem(world),
 *     // Phase 2a (update) — runs second, sees fresh input.
 *     physics: () => new PhysicsSystem(world),
 *     // Phase 3a (post-update) — runs third, sees settled positions.
 *     camera: () => new CameraSystem(world),
 *   }),
 *   prefabs: prefabRegistry,
 * });
 *
 * // Per-frame loop: arcade2d does the rest.
 * app.ticker.add(() => world.update());
 * ```
 */
export class World extends AbstractComponentHost<World> {
  /**
   * Timestamp of the previous {@link World.update} tick, in monotonic
   * `performance.now()` milliseconds. `null` before the first tick so the
   * inaugural {@link WorldUpdate} can emit a zero delta rather than a
   * since-epoch jump.
   */
  private _previousTickTimestamp: number | null = null;

  /**
   * Timestamp of the world's first {@link World.update} tick, in monotonic
   * `performance.now()` milliseconds. Captured once on the first tick and
   * used as the anchor for `elapsedMilliseconds` thereafter.
   */
  private _firstTickTimestamp: number | null = null;

  /**
   * Zero-based counter incremented on every {@link World.update} call.
   * Exposed to behavior code via {@link WorldUpdate.frameIndex}.
   */
  private _frameIndex = 0;

  private _isUpdating = false;
  private _objects: WorldObject[] = [];
  private _pendingObjects: WorldObject[] = [];

  private readonly _mappedObjects: Map<string, WorldObject> = new Map();
  private readonly _idGenerator = new IDGenerator();
  private readonly _onError?: (context: WorldErrorContext) => void;
  private readonly _prefabs?: PrefabRegistry;

  constructor(options: WorldOptions) {
    super();

    this._onError = options.onError;
    this._prefabs = options.prefabs;

    // Auto-attach the engine's own world-scoped infrastructure before the
    // user's components run. This makes {@link World.camera} a non-null
    // invariant and lets user components resolve `Camera` as a dependency
    // through the normal `requireSibling` channel.
    this.addComponentsFromFactories({
      [CAMERA_COMPONENT_KEY]: () => new Camera(this),
    });

    this.addComponentsFromFactories(options.components(this));
  }

  /**
   * The world's auto-attached {@link Camera}. Always present — the engine
   * registers a camera during construction before any user components run,
   * so this getter never returns `null` and game code can treat the
   * camera's existence as an invariant.
   *
   * @example
   * ```typescript
   * // Anchor the view on the player every frame.
   * world.camera.position.copyFrom(player.position);
   * ```
   */
  public get camera(): Camera {
    return this.getComponentByType(Camera);
  }

  /**
   * Returns the current mouse state — cursor position (both in world
   * space, with the camera transform inverted, and in raw canvas-local
   * pixels) and the held/released state of the three standard buttons.
   *
   * The returned {@link MouseState} is a fresh snapshot per call; the
   * engine deliberately never hands back a live reference, so a caller
   * stashing the value for a frame won't see it change mid-tick.
   *
   * Requires a mouse component registered under {@link MOUSE_COMPONENT_KEY}.
   * The convenience {@link bootstrap} function does this automatically; if
   * you're constructing the world yourself, register a `Mouse` from the
   * `input/` module the same way you'd register a {@link Scene}. Calling
   * this method without a registered mouse throws
   * {@link ErrorCode.COMPONENT_NOT_FOUND}.
   *
   * @example
   * ```typescript
   * onUpdate() {
   *   const { position, leftButton } = this.host.world.getMouseState();
   *
   *   if (leftButton) {
   *     this.host.position.moveTowards(position, 5);
   *   }
   * }
   * ```
   */
  public getMouseState(): MouseState {
    return this.getComponent<MouseStateProvider>(
      MOUSE_COMPONENT_KEY,
    ).getState();
  }

  /**
   * The {@link PrefabRegistry} this world resolves prefabs against by name,
   * or `null` if no registry was attached at construction. Exposed so callers
   * can introspect or share the registry with other systems (e.g. editor
   * tools).
   */
  public get prefabs(): PrefabRegistry | null {
    return this._prefabs ?? null;
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
   * Creates a new world object from a target prefab. The object is added to
   * the world's live set immediately if called outside a tick, or queued
   * into the pending set if called from within an `onUpdate` handler — see
   * the {@link World} class docs for the full spawn-timing contract.
   *
   * @param prefab The prefab to create an object from.
   * @param position The starting position of the new object in the world.
   */
  public createFromPrefab(
    prefab: Prefab,
    position = Point.zero(),
  ): WorldObject {
    const object = prefab.buildObject(PREFAB_BUILD_TOKEN, this, position);

    return this.add(object);
  }

  /**
   * Creates a new world object from a prefab looked up by name in the
   * world's attached {@link PrefabRegistry}. Throws if no registry was
   * passed at construction, or if the registry has no prefab under the
   * given name.
   *
   * This is the entry point intended for deserialised world state — saved
   * data refers to prefabs by name, and this method is how the engine
   * rehydrates them.
   *
   * @param name The name of the prefab to look up in the attached registry.
   * @param position The starting position of the new object in the world.
   */
  public createFromPrefabName(
    name: string,
    position = Point.zero(),
  ): WorldObject {
    if (!this._prefabs) {
      throwEngineError(
        ErrorCode.PREFAB_REGISTRY_NOT_ATTACHED,
        'Cannot create from prefab name — no PrefabRegistry was attached ' +
          'to this World. Pass `prefabs` in WorldOptions to enable name ' +
          'lookups.',
        { name },
      );
    }

    return this.createFromPrefab(this._prefabs.get(name), position);
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

  public update(): WorldUpdate {
    // Capture `now` once so the value threaded into WorldUpdate is the same
    // one stored as `_previousTickTimestamp` for the next frame. Otherwise
    // the next frame would diff against a timestamp later than this frame's
    // `now`, silently dropping the time spent inside update() itself from
    // the running clock.
    //
    // `performance.now()` is monotonic (unlike `Date.now()`, which can jump
    // backwards under NTP sync or DST adjustments) so deltas can be trusted
    // to be non-negative.
    const now = performance.now();

    if (this._firstTickTimestamp === null) {
      this._firstTickTimestamp = now;
    }

    // First tick has no prior timestamp to diff against; emit a zero delta
    // rather than a since-epoch jump that would teleport every moving
    // entity. Subsequent ticks diff against the previous tick's `now`.
    const deltaMilliseconds =
      this._previousTickTimestamp === null
        ? 0
        : now - this._previousTickTimestamp;
    const elapsedMilliseconds = now - this._firstTickTimestamp;

    const update = new WorldUpdate(
      deltaMilliseconds,
      elapsedMilliseconds,
      this._frameIndex,
    );

    this._isUpdating = true;

    // try/finally guarantees `_isUpdating` is reset even if a component or
    // object hook throws. Without this, a single thrown error would wedge
    // every future spawn into pending forever.
    try {
      // Phase 1: pre-update. World components first, then objects. Objects
      // marked destroyed mid-phase are skipped for the remaining phases
      // this tick.
      this._runWorldComponentPhase(
        'onPreUpdate',
        'component-pre-update',
        update,
      );
      for (const object of this._objects) {
        if (object.destroyed) {
          continue;
        }

        object.onPreUpdate(update);
      }

      // Phase 2: main update. Same ordering rule: world components, then
      // live objects.
      this._runWorldComponentPhase('onUpdate', 'component-update', update);
      for (const object of this._objects) {
        if (object.destroyed) {
          continue;
        }

        object.onUpdate(update);
      }

      // Phase 3: post-update. World components, then live objects. The
      // place to read state that all preceding components have already
      // settled — camera follow, transform sync, etc.
      this._runWorldComponentPhase(
        'onPostUpdate',
        'component-post-update',
        update,
      );
      for (const object of this._objects) {
        if (object.destroyed) {
          continue;
        }

        object.onPostUpdate(update);
      }

      // Phase 4a: sweep destroyed objects from the live set. We track a set
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

        this._objects = this._objects.filter((object) => !sweptSet.has(object));
      }

      // Phase 4b: flush objects spawned during this tick. An object that was
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

    this._previousTickTimestamp = now;
    this._frameIndex += 1;

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

  protected override _createDependencyResolver(
    component: Component<World>,
    key: string,
  ): WorldComponentDependencyResolver {
    return new WorldComponentDependencyResolver(this, component, key);
  }

  /**
   * Iterates this world's own components and invokes the named phase
   * method on each, isolating throws so a single bad component does not
   * abort the tick. Disabled components and components that do not
   * implement the optional hook are skipped at a single property read.
   * The resolved dependencies cached during `addComponents` are threaded
   * into every invocation as the trailing `deps` argument.
   *
   * A host-level {@link AbstractComponentHost.enabled} of `false` short-
   * circuits this phase before any world component is touched. Note this
   * gates only the world's own components — the object iteration in
   * `update()` continues to run. Stop world objects from ticking by not
   * calling `update()` at all.
   *
   * @param method The phase method to invoke on each component.
   * @param errorPhase The {@link WorldErrorPhase} label attached to thrown
   * errors during this phase.
   * @param update The {@link WorldUpdate} instance for this tick.
   */
  private _runWorldComponentPhase(
    method: 'onPreUpdate' | 'onUpdate' | 'onPostUpdate',
    errorPhase:
      | 'component-pre-update'
      | 'component-update'
      | 'component-post-update',
    update: WorldUpdate,
  ): void {
    if (!this.enabled) {
      return;
    }

    for (const [key, component] of this.components) {
      if (component.enabled === false) {
        continue;
      }

      const hook = component[method];

      if (!hook) {
        continue;
      }

      const deps = this._getDepsFor(component);

      try {
        hook.call(component, update, deps);
      } catch (error) {
        this.reportError({
          phase: errorPhase,
          error,
          host: this,
          componentKey: key,
        });
      }
    }
  }
}
