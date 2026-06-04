import type { Circle, Polygon, Rectangle } from '../geometry';
import type { PointPrimitive } from '../geometry/point.types';

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
}
