import RAPIER from '@dimforge/rapier2d-compat';
import type {
  Collider,
  ColliderDesc,
  RigidBody as RapierRigidBody,
  RigidBodyDesc,
  World as RapierWorld,
} from '@dimforge/rapier2d-compat';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { Point } from '../geometry';
import type { PointPrimitive } from '../geometry/point.types';
import { AbstractWorldComponent, World, WorldUpdate } from '../world';
import {
  DEFAULT_FIXED_TIME_STEP,
  DEFAULT_GRAVITY,
  DEFAULT_MAX_SUB_STEPS,
  DEFAULT_PIXELS_PER_METER,
} from './physics-world.constants';
import { assertPhysicsReady } from './physics.support';
import type { PhysicsWorldOptions } from './physics-world.types';

/**
 * The world-scoped owner of the physics simulation: a thin, opinionated
 * arcade2d façade over a [Rapier](https://rapier.rs) `World`. Add one to a
 * {@link World} and every {@link RigidBody} component in that world registers
 * its body and colliders here, gets integrated under gravity, and collides
 * against its peers.
 *
 * Physics is **opt-in** — the engine does not auto-attach a `PhysicsWorld` the
 * way it does a {@link Scene} or the input samplers. Register one through the
 * world's component factory, and call {@link initPhysics} first (Rapier is
 * WebAssembly and must be initialised before any of its objects exist).
 *
 * ## The frame pipeline (why bodies don't lag the render)
 *
 * Getting the order of "apply input → step → read back → draw" right is the
 * whole game with a physics integration. The engine ticks each world in three
 * phases — pre-update, update, post-update — and within every phase the
 * world-scoped components (this one) run before the object-scoped ones
 * ({@link RigidBody}, graphics). This `PhysicsWorld` slots the simulation step
 * into that schedule so the result is correct **regardless of the order
 * components were added to their objects**:
 *
 * 1. **`PhysicsWorld.onPreUpdate`** (world, runs first) — drains a
 *    fixed-timestep accumulator and calls Rapier's `step()` zero or more
 *    times, advancing the sim using the forces and velocities set during the
 *    *previous* frame's update phase.
 * 2. **`RigidBody.onPreUpdate`** (object, runs right after) — copies each
 *    simulated body's transform back onto its host {@link WorldObject}
 *    (`position`, `rotation`). Because this happens in pre-update, the host
 *    transform is settled before any gameplay or rendering code reads it.
 * 3. **gameplay `onUpdate`** (object) — controllers read the fresh host
 *    position and influence bodies through {@link RigidBody} methods
 *    (`applyImpulse`, `velocity`, …). Those calls reach Rapier immediately;
 *    their effect appears after the *next* frame's step.
 * 4. **graphics `onPostUpdate`** (object) — the existing
 *    {@link AbstractGraphics} transform-sync copies the host position into the
 *    display object. Since step 2 already ran, the visual is never a frame
 *    behind the simulation.
 *
 * This is the standard fixed-timestep ("`FixedUpdate`") pipeline: inputs set
 * this frame are integrated next frame — a single, imperceptible frame of
 * latency — in exchange for an ordering that has no hidden dependency on
 * component registration order.
 *
 * ## Units
 *
 * Everything at this surface is in the engine's **pixel** space. Gravity is
 * pixels/second², body positions are the same pixels as
 * {@link WorldObject.position}, and collider sizes are pixels. Internally the
 * {@link PhysicsWorldOptions.pixelsPerMeter} option is fed to Rapier's
 * `lengthUnit` so the solver stays numerically stable at that scale without
 * any coordinate conversion leaking into your game code.
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
 *
 * @see {@link RigidBody} — the per-object component that registers bodies here.
 * @see {@link initPhysics} — the one-time async WASM bootstrap.
 */
export class PhysicsWorld extends AbstractWorldComponent {
  private readonly _world: RapierWorld;
  private readonly _fixedTimeStep: number;
  private readonly _maxSubSteps: number;

  // Real elapsed time owed to the simulation but not yet stepped. Carries the
  // sub-timestep remainder across frames so the average step rate matches
  // wall-clock time regardless of frame pacing.
  private _accumulator = 0;

  // Set once `onDestroy` frees the Rapier world. Every method that reaches
  // into the freed WASM `_world` checks this first: touching freed Rapier
  // memory is a hard crash, not a catchable JS throw, so we must guard rather
  // than let a straggler call (e.g. a RigidBody.onDestroy that runs after the
  // world was torn down) reach Rapier at all.
  private _freed = false;

  /**
   * @param host The {@link World} this simulation belongs to.
   * @param options Optional configuration — gravity, scale, and stepping. See
   * {@link PhysicsWorldOptions}.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.PHYSICS_NOT_INITIALISED} if {@link initPhysics} has not
   *   completed — Rapier's WASM module must be ready before its `World` can be
   *   constructed.
   */
  constructor(host: World, options: PhysicsWorldOptions = {}) {
    super(host);

    assertPhysicsReady();

    const gravity = options.gravity ?? DEFAULT_GRAVITY;

    this._world = new RAPIER.World({ x: gravity.x, y: gravity.y });
    // Tell Rapier how big a "meter" is in our pixels so its internal
    // tolerances are scaled for a pixel-sized world; coordinates stay pixels.
    this._world.lengthUnit = options.pixelsPerMeter ?? DEFAULT_PIXELS_PER_METER;

    this._fixedTimeStep = options.fixedTimeStep ?? DEFAULT_FIXED_TIME_STEP;
    this._world.timestep = this._fixedTimeStep;
    this._maxSubSteps = options.maxSubSteps ?? DEFAULT_MAX_SUB_STEPS;
  }

  /**
   * Direct access to the underlying Rapier `World` instance.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — joints, ray/shape casts, contact-event
   * queues, character controllers, debug-render buffers, anything we haven't
   * decided how to model yet. Code that touches `raw` is coupled to Rapier's
   * public API and may break when:
   *
   * - arcade2d upgrades Rapier (including minor versions).
   * - Rapier itself ships a breaking change.
   * - arcade2d swaps Rapier for a different physics engine.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed methods on this component; reach for `raw` only
   * when no equivalent exists, and isolate the access behind your own helper
   * so the coupling is in one place.
   */
  public get raw(): RapierWorld {
    return this._world;
  }

  /**
   * The world's gravity, in pixels per second squared. Returns a fresh
   * {@link Point} (a mutable copy — writing to it does not change the
   * simulation; assign through the setter instead).
   */
  public get gravity(): Point {
    return new Point(this._world.gravity.x, this._world.gravity.y);
  }

  /**
   * Sets the world's gravity, in pixels per second squared. Takes effect on
   * the next step. Sleeping bodies are not woken — nudge them via a
   * {@link RigidBody} method if you need an instantaneous response.
   */
  public set gravity(value: PointPrimitive) {
    this._world.gravity = { x: value.x, y: value.y };
  }

  /**
   * The fixed timestep the simulation advances by, in seconds.
   */
  public get fixedTimeStep(): number {
    return this._fixedTimeStep;
  }

  /**
   * Registers a rigid body in the simulation from a Rapier descriptor.
   * Engine-internal seam used by {@link RigidBody.onAdded}; game code never
   * calls this directly.
   *
   * @param desc The Rapier `RigidBodyDesc` describing the body to create.
   * @returns The live Rapier `RigidBody`.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.PHYSICS_BODY_NOT_ATTACHED} if the world has already
   *   been freed.
   * @internal
   */
  public createBody(desc: RigidBodyDesc): RapierRigidBody {
    this._assertLive();

    return this._world.createRigidBody(desc);
  }

  /**
   * Attaches a collider to a previously-created body. Engine-internal seam
   * used by {@link RigidBody.onAdded}.
   *
   * @param desc The Rapier `ColliderDesc` describing the collider's shape and
   * material.
   * @param parent The body the collider is rigidly attached to.
   * @returns The live Rapier `Collider`.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.PHYSICS_BODY_NOT_ATTACHED} if the world has already
   *   been freed.
   * @internal
   */
  public createCollider(desc: ColliderDesc, parent: RapierRigidBody): Collider {
    this._assertLive();

    return this._world.createCollider(desc, parent);
  }

  /**
   * Removes a body and all of its attached colliders from the simulation.
   * Engine-internal seam used by {@link RigidBody.onDestroy}.
   *
   * @param body The Rapier body to remove.
   * @internal
   */
  public removeBody(body: RapierRigidBody): void {
    // No-op after free: world teardown destroys every object (and so every
    // RigidBody.onDestroy runs removeBody) *before* the PhysicsWorld's own
    // onDestroy frees the world — but a straggler removal afterward would
    // reach freed memory. The body is already gone with the world, so
    // silently doing nothing is correct, not an error.
    if (this._freed) {
      return;
    }

    this._world.removeRigidBody(body);
  }

  /**
   * Advances the simulation. Runs in pre-update — ahead of the per-object
   * readback and all gameplay code — so the rest of the tick observes a
   * settled physics state. Real frame time is accumulated and spent in fixed
   * `fixedTimeStep` increments (capped at `maxSubSteps` per frame) so the
   * simulation is deterministic with respect to step count and independent of
   * display refresh rate.
   */
  public onPreUpdate(update: WorldUpdate): void {
    // A tick after teardown would step freed WASM memory. Shouldn't happen
    // under normal world lifecycle, but cheap insurance against a crash.
    if (this._freed) {
      return;
    }

    this._accumulator += update.deltaSeconds;

    // Cap the backlog before draining so a long stall can't queue an
    // unbounded number of steps (the "spiral of death"). Excess time is
    // dropped, trading one slow-motion frame for a frozen one.
    const maxBacklog = this._fixedTimeStep * this._maxSubSteps;

    if (this._accumulator > maxBacklog) {
      this._accumulator = maxBacklog;
    }

    while (this._accumulator >= this._fixedTimeStep) {
      this._world.step();
      this._accumulator -= this._fixedTimeStep;
    }
  }

  /**
   * Releases the WebAssembly memory backing the Rapier world. After this the
   * component (and any {@link RigidBody} that depended on it) is unusable —
   * fired automatically during world teardown.
   */
  public override onDestroy(): void {
    if (this._freed) {
      return;
    }

    this._freed = true;
    this._world.free();
  }

  // Guards the body/collider creation seams against being called after the
  // world is freed. Unlike removal (which is harmlessly idempotent), creating
  // into a freed world is a programming error worth surfacing loudly.
  private _assertLive(): void {
    if (this._freed) {
      throwEngineError(
        ErrorCode.PHYSICS_BODY_NOT_ATTACHED,
        'This PhysicsWorld has been destroyed; its Rapier world is freed and ' +
          'can no longer create bodies or colliders.',
        {},
      );
    }
  }
}
