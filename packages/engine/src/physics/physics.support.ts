import RAPIER from '@dimforge/rapier2d-compat';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';

/**
 * Module-level latch tracking whether Rapier's WebAssembly module has been
 * compiled and instantiated. Rapier ships as WASM; none of its classes
 * (`World`, `RigidBodyDesc`, `ColliderDesc`, …) can be constructed until the
 * module is ready, so the engine gates every physics entry point on this
 * flag and surfaces a {@link ErrorCode.PHYSICS_NOT_INITIALISED} when it is
 * still `false`.
 */
let ready = false;

/**
 * Memoised in-flight initialisation promise. Held so that concurrent callers
 * of {@link initPhysics} (e.g. a preload routine and a world factory racing on
 * startup) all await the *same* WASM compile rather than triggering several.
 */
let pending: Promise<void> | null = null;

/**
 * Loads and instantiates the Rapier physics engine's WebAssembly module.
 *
 * The physics subsystem wraps [Rapier](https://rapier.rs), a Rust physics
 * engine compiled to WebAssembly. WASM has to be fetched, compiled, and
 * instantiated before any Rapier object can be constructed — which is an
 * asynchronous, one-time cost. `initPhysics` performs that step and records
 * that it succeeded, unblocking {@link PhysicsWorld} construction.
 *
 * ### Where this fits in startup
 *
 * Call it once, after {@link Game.bootstrap} and **before**
 * {@link Game.createWorld}, mirroring the engine's existing
 * "load-then-create" convention for assets
 * (`await game.assets.loadMany(...)` before building the world that uses
 * them). A {@link PhysicsWorld} constructed before this resolves throws
 * {@link ErrorCode.PHYSICS_NOT_INITIALISED}.
 *
 * ### Idempotence
 *
 * Safe to call any number of times. The first call performs the WASM init;
 * every later call (including concurrent calls made before the first settles)
 * resolves against the same underlying promise and returns immediately once
 * it has completed. There is no teardown counterpart — the compiled module
 * lives for the lifetime of the page.
 *
 * @returns A promise that resolves once Rapier is ready to use.
 *
 * @example
 * ```ts
 * import { Game, initPhysics, PhysicsWorld } from '@arcade2d/engine';
 *
 * const game = await Game.bootstrap({ canvas: { fill: 'window' } });
 * await initPhysics();
 *
 * const world = game.createWorld({
 *   components: (world) => ({
 *     physics: () => new PhysicsWorld(world, { gravity: { x: 0, y: 980 } }),
 *   }),
 * });
 * ```
 */
export async function initPhysics(): Promise<void> {
  if (ready) {
    return;
  }

  // Collapse concurrent first-time callers onto one compile. `RAPIER.init`
  // resolves the WASM instantiation; only after it settles do we flip the
  // latch, so a caller that awaits us is guaranteed a usable engine.
  pending ??= RAPIER.init().then(() => {
    ready = true;
  });

  return pending;
}

/**
 * Returns whether {@link initPhysics} has completed. Mostly useful for tooling
 * and tests; production code should simply `await initPhysics()` rather than
 * poll this.
 */
export function isPhysicsReady(): boolean {
  return ready;
}

/**
 * Throws unless Rapier's WASM module has been initialised via
 * {@link initPhysics}. Engine-internal guard used by {@link PhysicsWorld} so
 * the failure is a codified {@link EngineError} naming the fix, rather than an
 * opaque Rapier exception about touching an uninstantiated WASM export.
 *
 * @throws {@link EngineError} with code
 *   {@link ErrorCode.PHYSICS_NOT_INITIALISED} when physics has not been
 *   initialised yet.
 *
 * @internal
 */
export function assertPhysicsReady(): void {
  if (!ready) {
    throwEngineError(
      ErrorCode.PHYSICS_NOT_INITIALISED,
      'The Rapier physics engine has not been initialised. Call and await ' +
        '`initPhysics()` after `Game.bootstrap()` and before creating a ' +
        'world that uses a PhysicsWorld component.',
    );
  }
}
