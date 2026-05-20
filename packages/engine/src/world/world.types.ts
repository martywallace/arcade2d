import type { Component } from '../components.types';
import type { PrefabRegistry } from './prefab-registry';
import type { World } from './world';
import type { WorldObject } from './world-object';

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
 * Optional flags accepted by {@link World.findByTag} and
 * {@link World.findOneByTag}.
 */
export type FindByTagOptions = {
  /**
   * When `true`, the query also considers objects that were spawned
   * during the current tick and are still in the world's pending buffer
   * (i.e. have not yet been promoted into the live iteration set). The
   * default `false` excludes them so bulk tag queries never see an object
   * whose components have not started ticking — see
   * {@link World.findByTag} for the rationale.
   *
   * The flag is meaningful only when called from inside a {@link World.update}
   * tick. Outside a tick, every spawned object is already live and the
   * pending set is empty, so the flag has no observable effect.
   */
  readonly includePending?: boolean;
};

/**
 * Options accepted by the {@link World} constructor.
 */
export type WorldOptions = {
  /**
   * Factory map of world-scoped components to register on this world. Run
   * after the engine's own auto-attached components, so the user's
   * components see the {@link Camera} (and any future auto-attached
   * infrastructure) as already-resolvable siblings.
   *
   * The key {@link CAMERA_COMPONENT_KEY} is reserved by the engine —
   * attempting to register a component under that key will throw
   * {@link ErrorCode.COMPONENT_ALREADY_EXISTS}. The same is true of
   * {@link SCENE_COMPONENT_KEY} when the world is created via
   * `Game.createWorld`, which auto-attaches a `Scene`.
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
