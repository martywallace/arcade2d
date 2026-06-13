import RAPIER from '@dimforge/rapier2d-compat';
import type {
  RigidBody as RapierRigidBody,
  RigidBodyDesc,
} from '@dimforge/rapier2d-compat';
import { Point } from '../geometry';
import type { PointPrimitive } from '../geometry/point.types';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import {
  AbstractWorldObjectComponent,
  WorldObject,
  WorldObjectDependencyResolver,
} from '../world';
import { PhysicsWorld } from './physics-world';
import { toColliderDesc } from './rigid-body.support';
import type {
  ColliderOptions,
  CollisionListener,
  RigidBodyOptions,
  RigidBodyType,
} from './rigid-body.types';

/**
 * The resolved dependencies of a {@link RigidBody}: the world's
 * {@link PhysicsWorld}, located via the cross-tier dependency resolver.
 */
type RigidBodyDeps = {
  readonly physics: PhysicsWorld;
};

/**
 * Gives a {@link WorldObject} a physical presence: a Rapier rigid body and one
 * or more colliders that fall under gravity, collide with the rest of the
 * world's bodies, and (for dynamic bodies) drive the host's transform.
 *
 * `RigidBody` is the per-object half of the physics subsystem; it declares a
 * dependency on the world's {@link PhysicsWorld} and registers itself there.
 * Add at least one collider through {@link RigidBodyOptions.collider} or
 * {@link RigidBodyOptions.colliders} — a body with no collider has no shape to
 * collide with and is rejected.
 *
 * ## Who owns the transform
 *
 * Which direction the transform flows depends on {@link RigidBodyOptions.type}
 * (see {@link RigidBodyType} for the full table):
 *
 * - **`dynamic`** and **`kinematic-velocity`** — the *simulation* owns the
 *   transform. Each frame, after {@link PhysicsWorld} steps, this component
 *   copies the body's position and rotation back onto the host in its
 *   pre-update phase. Don't write `host.position` directly; influence the body
 *   through {@link RigidBody.velocity}, {@link RigidBody.applyImpulse}, and
 *   friends instead.
 * - **`kinematic-position`** — the *host* owns the transform. Set
 *   `host.position` / `host.rotation` from your own code and the component
 *   feeds them into the body as its next kinematic target, so dynamic bodies
 *   collide against the scripted motion.
 * - **`fixed`** — never moves; the transform is read once at attach time.
 *
 * The body is seeded from the host's transform when the component is added, so
 * position the {@link WorldObject} before attaching this.
 *
 * See {@link PhysicsWorld} for the frame-pipeline rationale behind reading the
 * transform back in pre-update (short version: it keeps graphics from lagging
 * the simulation by a frame, with no dependency on component order).
 *
 * @example
 * ```ts
 * import {
 *   CircleGraphics, Circle, RigidBody, Prefab,
 * } from '@arcade2d/engine';
 *
 * export const BallPrefab = new Prefab({
 *   name: 'ball',
 *   components: {
 *     graphics: ({ object }) => new CircleGraphics(object, new Circle(16)),
 *     body: ({ object }) =>
 *       new RigidBody(object, {
 *         type: 'dynamic',
 *         collider: { shape: new Circle(16), restitution: 0.6 },
 *       }),
 *   },
 * });
 * ```
 *
 * @see {@link PhysicsWorld} — the world-scoped simulation this registers with.
 * @see {@link RigidBodyOptions} — the full set of construction knobs.
 */
export class RigidBody extends AbstractWorldObjectComponent<RigidBodyDeps> {
  private readonly _type: RigidBodyType;
  private readonly _options: RigidBodyOptions;
  private readonly _colliders: readonly ColliderOptions[];

  // The live Rapier body. Null until onAdded creates it (and again would-be
  // null after onDestroy); control methods guard on it.
  private _body: RapierRigidBody | null = null;

  // Captured in onAdded so onDestroy can deregister the body without
  // re-resolving the dependency.
  private _physics: PhysicsWorld | null = null;

  // Collision listeners pulled out of the options, kept as own fields so the
  // hot dispatch path doesn't re-read the options object. Either being present
  // is what opts the body into Rapier's collision-event reporting.
  private readonly _onCollisionStart?: CollisionListener;
  private readonly _onCollisionEnd?: CollisionListener;

  // Rapier collider handles created in onAdded, retained so onDestroy can
  // unregister them from the PhysicsWorld's handle→body lookup.
  private readonly _colliderHandles: number[] = [];

  /**
   * @param host The {@link WorldObject} to give a physical body.
   * @param options Body type, colliders, and initial motion. See
   * {@link RigidBodyOptions}.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.PHYSICS_NO_COLLIDER} when neither `collider` nor a
   *   non-empty `colliders` is supplied.
   */
  constructor(host: WorldObject, options: RigidBodyOptions) {
    super(host);

    const colliders =
      options.colliders ?? (options.collider ? [options.collider] : []);

    if (colliders.length === 0) {
      throwEngineError(
        ErrorCode.PHYSICS_NO_COLLIDER,
        'A RigidBody needs at least one collider. Pass `collider` (one) or ' +
          '`colliders` (several) in its options.',
        { host },
      );
    }

    this._options = options;
    this._type = options.type ?? 'dynamic';
    this._colliders = colliders;
    this._onCollisionStart = options.onCollisionStart;
    this._onCollisionEnd = options.onCollisionEnd;
  }

  /**
   * Declares the cross-tier dependency on the world's {@link PhysicsWorld}.
   *
   * @param resolver The object-tier dependency resolver.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.WORLD_COMPONENT_DEPENDENCY_MISSING} when the world has
   *   no {@link PhysicsWorld} component to register with.
   */
  public resolveDependencies(
    resolver: WorldObjectDependencyResolver,
  ): RigidBodyDeps {
    return { physics: resolver.requireFromWorld(PhysicsWorld) };
  }

  /**
   * Direct access to the underlying Rapier `RigidBody` instance.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — joints, per-collider mass overrides,
   * fine-grained sleep control, anything we haven't decided how to model yet.
   * Code that touches `raw` is coupled to Rapier's public API and may break
   * when:
   *
   * - arcade2d upgrades Rapier (including minor versions).
   * - Rapier itself ships a breaking change.
   * - arcade2d swaps Rapier for a different physics engine.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed methods on this component; reach for `raw` only
   * when no equivalent exists, and isolate the access behind your own helper
   * so the coupling is in one place.
   *
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.PHYSICS_BODY_NOT_ATTACHED} if read before the component
   *   has been added to a {@link WorldObject} (or after it was destroyed).
   */
  public get raw(): RapierRigidBody {
    return this._requireBody();
  }

  /**
   * This body's {@link RigidBodyType}.
   */
  public get type(): RigidBodyType {
    return this._type;
  }

  /**
   * The body's linear velocity, in pixels per second, as a fresh
   * {@link Point}. Returned as `Readonly` so the "I mutated it and nothing
   * happened" footgun is a compile error — assign a new value through the
   * setter to change the body's velocity.
   */
  public get velocity(): Readonly<Point> {
    const velocity = this._requireBody().linvel();

    return new Point(velocity.x, velocity.y);
  }

  /**
   * Sets the body's linear velocity, in pixels per second, and wakes it if it
   * was asleep.
   */
  public set velocity(value: PointPrimitive) {
    this._requireBody().setLinvel({ x: value.x, y: value.y }, true);
  }

  /**
   * The body's angular velocity, in radians per second.
   */
  public get angularVelocity(): number {
    return this._requireBody().angvel();
  }

  /**
   * Sets the body's angular velocity, in radians per second, and wakes it if
   * it was asleep.
   */
  public set angularVelocity(value: number) {
    this._requireBody().setAngvel(value, true);
  }

  /**
   * Applies an instantaneous linear impulse to the body's centre of mass, in
   * pixel·mass units per second, immediately changing its velocity. Use this
   * for one-off kicks (a jump, a bullet hit). Has no effect on `fixed` or
   * kinematic bodies.
   *
   * @param impulse The impulse vector to apply.
   */
  public applyImpulse(impulse: PointPrimitive): void {
    this._requireBody().applyImpulse({ x: impulse.x, y: impulse.y }, true);
  }

  /**
   * Adds a continuous force to the body for the next step, in pixel·mass units
   * per second squared. Unlike {@link RigidBody.applyImpulse}, a force
   * accelerates the body gradually; re-apply it every frame to sustain it.
   * Has no effect on `fixed` or kinematic bodies.
   *
   * @param force The force vector to apply.
   */
  public applyForce(force: PointPrimitive): void {
    this._requireBody().addForce({ x: force.x, y: force.y }, true);
  }

  /**
   * Applies an instantaneous angular impulse, immediately changing the body's
   * spin. Positive values spin clockwise (the engine's `y`-down convention).
   *
   * @param torqueImpulse The angular impulse to apply.
   */
  public applyTorqueImpulse(torqueImpulse: number): void {
    this._requireBody().applyTorqueImpulse(torqueImpulse, true);
  }

  /**
   * Whether the body is currently asleep — Rapier rests bodies that have been
   * still long enough, excluding them from simulation until something disturbs
   * them.
   */
  public get isSleeping(): boolean {
    return this._requireBody().isSleeping();
  }

  /**
   * Forces an asleep body awake so it participates in the next step even
   * without an external disturbance.
   */
  public wake(): void {
    this._requireBody().wakeUp();
  }

  /**
   * Teleports the body to a world position, in pixels, bypassing the
   * simulation. This is the supported way to respawn, warp, or reset a body
   * — a `dynamic` body's transform is owned by the simulation, so writing
   * `host.position` does nothing for it and the influence verbs
   * ({@link RigidBody.velocity}, {@link RigidBody.applyImpulse}) can't place
   * a body at an exact spot. The move is instantaneous and generates no
   * contacts along the way; existing linear velocity is preserved (zero it
   * via {@link RigidBody.velocity} for a clean stop). Wakes the body so the
   * change takes effect on the next step.
   *
   * @param position The target world position, in pixels.
   */
  public setPosition(position: PointPrimitive): void {
    this._requireBody().setTranslation({ x: position.x, y: position.y }, true);

    // Mirror onto the host immediately so the teleport is visible this frame
    // regardless of when it was called relative to the pre-update readback;
    // the next step's readback re-derives the same value.
    this.host.position.set(position.x, position.y);
  }

  /**
   * Teleports the body to an absolute rotation, in radians, bypassing the
   * simulation — the angular counterpart to {@link RigidBody.setPosition}.
   * Existing angular velocity is preserved; the body is woken.
   *
   * @param rotation The target rotation, in radians.
   */
  public setRotation(rotation: number): void {
    this._requireBody().setRotation(rotation, true);
    this.host.rotation = rotation;
  }

  /**
   * Creates the Rapier body and its colliders, seeded from the host transform,
   * and registers them with the world's {@link PhysicsWorld}.
   */
  public override onAdded({ physics }: RigidBodyDeps): void {
    this._physics = physics;

    const desc = this._buildBodyDesc();
    const body = physics.createBody(desc);

    // Only flag colliders for event reporting when this body actually listens.
    // Rapier emits a pair's events if *either* collider opts in, so a listening
    // body picks up contacts with inert static geometry without that geometry
    // needing a flag of its own.
    const wantsEvents = this._wantsCollisionEvents();

    for (const collider of this._colliders) {
      const colliderDesc = toColliderDesc(collider.shape);

      if (collider.offset) {
        colliderDesc.setTranslation(collider.offset.x, collider.offset.y);
      }

      if (collider.density !== undefined) {
        colliderDesc.setDensity(collider.density);
      }

      if (collider.friction !== undefined) {
        colliderDesc.setFriction(collider.friction);
      }

      if (collider.restitution !== undefined) {
        colliderDesc.setRestitution(collider.restitution);
      }

      if (collider.isSensor) {
        colliderDesc.setSensor(true);
      }

      if (wantsEvents) {
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      }

      const created = physics.createCollider(colliderDesc, body);

      // Register every collider (not just listening ones): resolving a drained
      // event needs to name both owners, and the non-listening side is still a
      // valid "other" party for whoever did opt in.
      this._colliderHandles.push(created.handle);
      physics._registerCollider(created.handle, this);
    }

    this._body = body;
  }

  /**
   * Whether this body subscribes to collision events — i.e. at least one of
   * {@link RigidBodyOptions.onCollisionStart} /
   * {@link RigidBodyOptions.onCollisionEnd} was supplied. Drives both the
   * collider event flag at attach time and the per-frame dispatch. Engine seam
   * read by {@link PhysicsWorld}.
   *
   * @internal
   */
  public _wantsCollisionEvents(): boolean {
    return Boolean(this._onCollisionStart || this._onCollisionEnd);
  }

  /**
   * Bridges the host transform and the simulated body once the world step has
   * run (this is an object-scoped pre-update, so {@link PhysicsWorld}'s
   * world-scoped step already executed this frame).
   *
   * - `kinematic-position`: pushes the host transform into the body as its
   *   next kinematic target (host drives body).
   * - `dynamic` / `kinematic-velocity`: copies the body's transform onto the
   *   host (body drives host).
   * - `fixed`: nothing — it never moves.
   */
  public onPreUpdate(): void {
    const body = this._body;

    if (!body || this._type === 'fixed') {
      return;
    }

    if (this._type === 'kinematic-position') {
      body.setNextKinematicTranslation({
        x: this.host.position.x,
        y: this.host.position.y,
      });
      body.setNextKinematicRotation(this.host.rotation);

      return;
    }

    const translation = body.translation();

    this.host.position.set(translation.x, translation.y);
    this.host.rotation = body.rotation();
  }

  /**
   * Delivers this frame's collisions to the body's listeners. Runs in the
   * object update phase — after {@link PhysicsWorld} stepped and drained the
   * event queue in the world pre-update, and after this component's own
   * pre-update readback — so listeners see settled transforms. Skipped entirely
   * for bodies with no listener.
   *
   * Because this is a normal component update hook, the host wraps it in the
   * world's per-component error isolation: a listener that throws is reported
   * through {@link World.reportError} (or the world's `onError`) without
   * derailing the rest of the tick.
   */
  public override onUpdate(): void {
    if (!this._physics || !this._wantsCollisionEvents()) {
      return;
    }

    for (const { other, started } of this._physics._takeCollisions(this)) {
      const listener = started ? this._onCollisionStart : this._onCollisionEnd;

      // The opposite-direction listener may be absent (e.g. a body that only
      // handles starts still gets end events buffered); just skip those.
      listener?.({ self: this, other, otherObject: other.host });
    }
  }

  /**
   * Removes the body (and its attached colliders, which Rapier frees with it)
   * from the simulation, and unregisters its collider handles from the
   * {@link PhysicsWorld} event lookup. Safe to call after a partial
   * construction where the body was never created.
   */
  public override onDestroy(): void {
    if (this._physics) {
      for (const handle of this._colliderHandles) {
        this._physics._unregisterCollider(handle);
      }

      if (this._body) {
        this._physics.removeBody(this._body);
      }
    }

    this._colliderHandles.length = 0;
    this._body = null;
  }

  /**
   * Builds the Rapier body descriptor for this component's type and options,
   * seeding translation and rotation from the host transform.
   */
  private _buildBodyDesc(): RigidBodyDesc {
    const desc = this._descForType();

    desc.setTranslation(this.host.position.x, this.host.position.y);
    desc.setRotation(this.host.rotation);

    const options = this._options;

    if (options.linearVelocity) {
      desc.setLinvel(options.linearVelocity.x, options.linearVelocity.y);
    }

    if (options.angularVelocity !== undefined) {
      desc.setAngvel(options.angularVelocity);
    }

    if (options.linearDamping !== undefined) {
      desc.setLinearDamping(options.linearDamping);
    }

    if (options.angularDamping !== undefined) {
      desc.setAngularDamping(options.angularDamping);
    }

    if (options.gravityScale !== undefined) {
      desc.setGravityScale(options.gravityScale);
    }

    if (options.lockRotation) {
      desc.lockRotations();
    }

    if (options.ccd) {
      desc.setCcdEnabled(true);
    }

    return desc;
  }

  /**
   * Maps the arcade2d {@link RigidBodyType} onto the matching Rapier
   * descriptor factory.
   */
  private _descForType(): RigidBodyDesc {
    switch (this._type) {
      case 'dynamic':
        return RAPIER.RigidBodyDesc.dynamic();
      case 'fixed':
        return RAPIER.RigidBodyDesc.fixed();
      case 'kinematic-velocity':
        return RAPIER.RigidBodyDesc.kinematicVelocityBased();
      case 'kinematic-position':
        return RAPIER.RigidBodyDesc.kinematicPositionBased();
    }
  }

  /**
   * Returns the live body, or throws if it isn't attached. Centralises the
   * null guard the control methods share.
   */
  private _requireBody(): RapierRigidBody {
    if (!this._body) {
      throwEngineError(
        ErrorCode.PHYSICS_BODY_NOT_ATTACHED,
        'This RigidBody has no live body. Add the component to a WorldObject ' +
          'before using it, and do not use it after the object is destroyed.',
        { host: this.host },
      );
    }

    return this._body;
  }
}
