import type { Circle, Polygon, Rectangle } from '../geometry';
import type { PointPrimitive } from '../geometry/point.types';
import type { WorldObject } from '../world';
import type { RigidBody } from './rigid-body';

/**
 * The simulation behaviour of a {@link RigidBody}.
 *
 * - `dynamic` — fully simulated: moved by gravity, forces, and collisions.
 *   The simulation owns the transform; it is written back onto the host every
 *   frame.
 * - `fixed` — immovable. Never integrated, infinite mass. The right choice for
 *   static level geometry (ground, walls).
 * - `kinematic-velocity` — moved only by a velocity you set; unaffected by
 *   forces or collisions, but pushes dynamic bodies out of its way. The
 *   simulation advances it and writes the result back to the host.
 * - `kinematic-position` — moved by directly steering the host transform; the
 *   body follows the host into the simulation and shoves dynamic bodies. The
 *   *host* owns the transform (you set `host.position` / `host.rotation`), and
 *   the body is driven from it. Use this to script the motion of a platform or
 *   door that still needs to collide.
 */
export type RigidBodyType =
  | 'dynamic'
  | 'fixed'
  | 'kinematic-velocity'
  | 'kinematic-position';

/**
 * A capsule collider shape — a rectangle capped with a semicircle on each end,
 * oriented vertically. Capsules are the standard collider for characters
 * because their rounded ends slide over edges and steps instead of catching on
 * them. arcade2d's geometry module models {@link Circle}, {@link Rectangle},
 * and {@link Polygon} but has no capsule primitive, so this small descriptor
 * names one for collider use.
 *
 * Both measurements are in pixels and define the shape centered on the host's
 * local origin: the total height is `halfHeight * 2 + radius * 2`.
 */
export interface Capsule {
  /**
   * Half the height of the capsule's central rectangle (excluding the rounded
   * caps), in pixels. Must be positive.
   */
  readonly halfHeight: number;

  /**
   * The radius of the rounded caps and the rectangle's width, in pixels. Must
   * be positive.
   */
  readonly radius: number;
}

/**
 * A shape usable as a physics collider. The engine's existing geometry
 * primitives double as collider shapes, plus {@link Capsule} for the one shape
 * geometry doesn't model.
 *
 * Shapes are interpreted in the host {@link WorldObject}'s **local space**,
 * exactly like the graphics components — vertex/centre `(0, 0)` is the host's
 * position. In particular a {@link Rectangle} collider is treated as
 * **centered on the origin** with the rectangle's `width`/`height` as its full
 * extents, matching `PolygonGraphics.asRectangle` (and intentionally differing
 * from the geometry {@link Rectangle}'s top-left anchoring). Offset a collider
 * from the origin with {@link ColliderOptions.offset} when you need it
 * off-center.
 */
export type ColliderShape = Circle | Rectangle | Polygon | Capsule;

/**
 * Describes one collider attached to a {@link RigidBody}: its shape plus the
 * material and role knobs that govern how it responds to contact. A body can
 * carry several, letting you build a compound silhouette from primitives.
 */
export interface ColliderOptions {
  /**
   * The collider's shape, in host-local space. See {@link ColliderShape}.
   */
  readonly shape: ColliderShape;

  /**
   * Local-space offset of the shape from the host origin, in pixels. Defaults
   * to `(0, 0)`. Use it to place a collider off-center or to assemble a
   * compound body from several offset primitives.
   */
  readonly offset?: PointPrimitive;

  /**
   * Mass density, in mass units per pixel². A dynamic body's mass and inertia
   * are derived from its colliders' densities and areas. Defaults to Rapier's
   * `1`. Ignored for `fixed` bodies (infinite mass).
   */
  readonly density?: number;

  /**
   * Surface friction coefficient. `0` is frictionless; higher values resist
   * sliding contact. Defaults to Rapier's `0.5`.
   */
  readonly friction?: number;

  /**
   * Bounciness, from `0` (no bounce, energy fully absorbed) to `1` (perfectly
   * elastic). Defaults to Rapier's `0`.
   */
  readonly restitution?: number;

  /**
   * When `true`, the collider detects overlaps and reports contacts but does
   * not push anything — a trigger volume. Defaults to `false`.
   */
  readonly isSensor?: boolean;
}

/**
 * A single collision delivered to a {@link RigidBody}'s
 * {@link RigidBodyOptions.onCollisionStart} or
 * {@link RigidBodyOptions.onCollisionEnd} listener: a description of *who*
 * touched (or stopped touching) the listening body this frame.
 *
 * The event is fired from the listening body's point of view, so
 * {@link CollisionEvent.self} is always the body whose listener is running and
 * {@link CollisionEvent.other} is its counterpart. Use the event to react to
 * contact — deal damage, play a hit sound, despawn a projectile — by reading
 * the other body's host {@link WorldObject} and its components.
 *
 * ## Lifetime and timing
 *
 * The event object is short-lived: it is constructed for the dispatch and not
 * retained by the engine, so it is safe to read synchronously but should not
 * be stashed for a later frame (capture the values you need instead). Listeners
 * run during the listening body's update phase, after the simulation has
 * stepped and transforms have been read back, so both hosts' positions are the
 * settled post-step values for the frame.
 *
 * Either party may already be marked for destruction by the time your listener
 * runs (another object's update earlier in the same frame may have called
 * {@link WorldObject.destroy}). The object is still live — its teardown is
 * deferred to the end of the tick — but check
 * {@link WorldObject.destroyed} before acting on it if your reaction depends on
 * it surviving.
 *
 * @see {@link RigidBodyOptions.onCollisionStart} — fired on first contact.
 * @see {@link RigidBodyOptions.onCollisionEnd} — fired when contact breaks.
 */
export interface CollisionEvent {
  /**
   * The body whose listener is running — i.e. the one the
   * {@link RigidBodyOptions.onCollisionStart} /
   * {@link RigidBodyOptions.onCollisionEnd} callback belongs to.
   */
  readonly self: RigidBody;

  /**
   * The other body involved in the contact.
   */
  readonly other: RigidBody;

  /**
   * Convenience accessor for `other.host` — the {@link WorldObject} the other
   * body is attached to, the usual entry point for reading its tags and
   * components.
   */
  readonly otherObject: WorldObject;
}

/**
 * A listener for {@link RigidBody} collision start/end events. See
 * {@link CollisionEvent} for the payload and {@link RigidBodyOptions.onCollisionStart}
 * for the enabling semantics.
 */
export type CollisionListener = (event: CollisionEvent) => void;

/**
 * Construction options for a {@link RigidBody}. A body needs at least one
 * collider — supply exactly one via {@link RigidBodyOptions.collider}, or
 * several via {@link RigidBodyOptions.colliders}. Providing neither throws
 * {@link ErrorCode.PHYSICS_NO_COLLIDER}.
 *
 * The body is seeded from the host {@link WorldObject}'s `position` and
 * `rotation` at attach time, so place the object before adding the component.
 * Velocities, impulses, and sizes are all in pixel units.
 */
export interface RigidBodyOptions {
  /**
   * The body's simulation behaviour. Defaults to `'dynamic'`. See
   * {@link RigidBodyType}.
   */
  readonly type?: RigidBodyType;

  /**
   * A single collider for the body. Shorthand for a one-element
   * {@link RigidBodyOptions.colliders}. Provide this or `colliders`, not both.
   */
  readonly collider?: ColliderOptions;

  /**
   * Multiple colliders making up a compound body. Provide this or `collider`.
   */
  readonly colliders?: readonly ColliderOptions[];

  /**
   * Initial linear velocity, in pixels per second. Defaults to zero.
   */
  readonly linearVelocity?: PointPrimitive;

  /**
   * Initial angular velocity, in radians per second. Defaults to zero.
   */
  readonly angularVelocity?: number;

  /**
   * Linear damping — a drag that bleeds off linear velocity over time. `0`
   * (the default) means no drag.
   */
  readonly linearDamping?: number;

  /**
   * Angular damping — a drag that bleeds off spin over time. `0` (the default)
   * means no drag.
   */
  readonly angularDamping?: number;

  /**
   * Per-body multiplier on the world's gravity. `1` (default) is normal
   * gravity, `0` makes the body float, negative values invert it.
   */
  readonly gravityScale?: number;

  /**
   * When `true`, prevents the body from rotating (it stays upright no matter
   * the contacts). Common for top-down characters. Defaults to `false`.
   */
  readonly lockRotation?: boolean;

  /**
   * Enables continuous collision detection, which stops fast-moving bodies
   * from tunnelling through thin geometry at the cost of extra work. Defaults
   * to `false`.
   */
  readonly ccd?: boolean;

  /**
   * Called once when this body **begins** touching another body, with a
   * {@link CollisionEvent} describing the other party. This is the primary
   * gameplay hook for contact reactions — a bullet despawning on impact, an
   * enemy taking damage, a trigger volume firing.
   *
   * ## Opting in
   *
   * Supplying this (or {@link RigidBodyOptions.onCollisionEnd}) is what enables
   * collision reporting for the body: the engine flips Rapier's
   * collision-event flag on the body's colliders. A body with no listener
   * generates no events and costs nothing — so the static walls a projectile
   * hits do **not** need a listener; only the projectile does. Rapier reports a
   * pair as soon as *either* collider opts in.
   *
   * ## Sensors vs. solid contact
   *
   * The hook fires for both kinds of overlap: solid bodies physically colliding
   * *and* a sensor collider ({@link ColliderOptions.isSensor}) passing through
   * another collider without pushing it. A fast projectile is typically a
   * sensor so it registers the hit without knocking its target around.
   *
   * ## Error handling and timing
   *
   * The callback runs during the body's own update phase and is wrapped in the
   * world's standard per-component error isolation: if it throws, the failure
   * is routed through {@link World.reportError} (or the world's `onError`
   * handler) and the rest of the tick continues. See {@link CollisionEvent}
   * for the guarantees about transform state and object lifetime at call time.
   *
   * @param event The collision, from this body's point of view.
   */
  readonly onCollisionStart?: CollisionListener;

  /**
   * Called once when this body **stops** touching another body it was
   * previously in contact with, with a {@link CollisionEvent} describing the
   * other party. Useful for un-applying something a
   * {@link RigidBodyOptions.onCollisionStart} did — leaving a trigger zone,
   * ending an overlap highlight.
   *
   * Like {@link RigidBodyOptions.onCollisionStart}, supplying this enables
   * collision reporting for the body, and the callback runs under the same
   * error isolation and timing guarantees.
   *
   * @param event The collision that just ended, from this body's point of view.
   */
  readonly onCollisionEnd?: CollisionListener;
}
