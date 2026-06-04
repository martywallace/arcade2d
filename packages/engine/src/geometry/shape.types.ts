import type { PointPrimitive } from './point.types';
import type { Rectangle } from './rectangle';

/**
 * The common contract every pure shape in the geometry package implements —
 * {@link Circle}, {@link Rectangle}, and {@link Polygon}. It exists so code
 * can treat shapes uniformly (measure them, test containment, test overlap,
 * copy them) without switching on the concrete type, which is what the
 * collision and spatial-query layers built on top of geometry need.
 *
 * Every shape is **positionless**: its geometry lives in its own local space,
 * and where it sits in the world is the owner's responsibility (a transform /
 * {@link WorldObject}). Queries that involve two shapes therefore take a
 * `offset` — the position of the *other* shape's local origin relative to
 * this shape's — rather than absolute coordinates.
 *
 * Note the two-level surface: shapes expose idiomatic conveniences beyond this
 * contract (a circle's `diameter`, a rectangle's `right`/`bottomLeft`), while
 * these methods are the uniform, polymorphic core shared by all of them.
 *
 * @see {@link Circle}, {@link Rectangle}, {@link Polygon} — the implementations.
 */
export interface Shape {
  /**
   * The unsigned area the shape encloses, in square local units.
   */
  getArea(): number;

  /**
   * The length of the shape's outline (a circle's circumference, a polygon's
   * perimeter including the closing edge).
   */
  getPerimeter(): number;

  /**
   * The smallest axis-aligned {@link Rectangle} that fully contains the shape,
   * as a positionless size (width × height).
   */
  getBoundingBox(): Rectangle;

  /**
   * Whether a point lies inside the shape. The point is expressed in the
   * shape's own local space. Edge behaviour is shape-specific — see each
   * implementation.
   *
   * @param point The point to test, in this shape's local space.
   */
  containsPoint(point: PointPrimitive): boolean;

  /**
   * Whether this shape overlaps `other`. Shapes that touch at a single point
   * or edge count as intersecting. Assumes convex shapes; results for a
   * concave {@link Polygon} are undefined.
   *
   * @param other The shape to test against — any {@link Shape} type.
   * @param offset The position of `other`'s local origin relative to this
   * shape's local origin.
   */
  intersects(other: Shape, offset: PointPrimitive): boolean;

  /**
   * Returns an independent copy of this shape.
   */
  clone(): Shape;
}
