import { shapesIntersect } from './intersection.support';
import type { PointPrimitive } from './point.types';
import type { Rectangle } from './rectangle';
import type { Shape } from './shape.types';

/**
 * Defines a circle as a pure shape: it is described entirely by its `radius`
 * and has no position of its own. Where a circle "is" in the world is the
 * responsibility of whatever owns it (e.g. a transform / `WorldObject`
 * position).
 *
 * Consequently, geometric queries operate in the circle's local space, where
 * the circle is centered on the origin `0,0`. Callers map world coordinates
 * into that space (and supply the relative offset between two shapes) before
 * calling.
 *
 * A negative `radius` is clamped to zero for containment and intersection
 * queries, so a degenerate circle reports no overlaps beyond its own center
 * point rather than producing inverted-radius nonsense.
 *
 * `Circle` implements {@link Shape}: alongside the circle-idiomatic
 * {@link Circle.diameter}, {@link Circle.circumference}, and
 * {@link Circle.area} getters it exposes the uniform {@link Shape.getArea},
 * {@link Shape.getPerimeter}, and {@link Shape.intersects} surface that lets
 * collision code treat any shape the same way.
 */
export class Circle implements Shape {
  /**
   * @param radius The radius of the circle. Expected to be non-negative.
   */
  constructor(public readonly radius = 0) {}

  /**
   * The distance across the circle through its center (`radius * 2`). A
   * negative radius is clamped to zero, matching the containment and
   * intersection queries, so a degenerate circle never reports a negative
   * measurement (including through the polymorphic {@link Shape.getPerimeter}).
   */
  public get diameter(): number {
    return Math.max(0, this.radius) * 2;
  }

  /**
   * The distance around the circle (`2πr`). A negative radius is clamped to
   * zero — see {@link Circle.diameter}.
   */
  public get circumference(): number {
    return Math.max(0, this.radius) * 2 * Math.PI;
  }

  /**
   * The area enclosed by the circle (`πr²`). A negative radius is clamped to
   * zero — see {@link Circle.diameter}.
   */
  public get area(): number {
    return Math.PI * Math.max(0, this.radius) ** 2;
  }

  /**
   * The {@link Shape} contract's area accessor — equivalent to the
   * {@link Circle.area} getter, in method form so a circle reads the same as
   * any other shape.
   */
  public getArea(): number {
    return this.area;
  }

  /**
   * The {@link Shape} contract's perimeter accessor — equivalent to the
   * {@link Circle.circumference} getter.
   */
  public getPerimeter(): number {
    return this.circumference;
  }

  /**
   * Determines whether a point lies inside this circle. The point is expressed
   * in the circle's local space (relative to its center). A point exactly on
   * the edge is treated as contained.
   *
   * @param point The point to test, relative to the circle's center.
   */
  public containsPoint(point: PointPrimitive): boolean {
    const radius = Math.max(0, this.radius);

    return point.x ** 2 + point.y ** 2 <= radius ** 2;
  }

  /**
   * Determines whether this circle overlaps another circle. Circles that touch
   * at exactly one point are considered intersecting.
   *
   * @param other The circle to test against.
   * @param offset The position of `other`'s center relative to this circle's
   * center.
   */
  public intersectsCircle(other: Circle, offset: PointPrimitive): boolean {
    const combined = Math.max(0, this.radius) + Math.max(0, other.radius);

    return offset.x ** 2 + offset.y ** 2 <= combined ** 2;
  }

  /**
   * Determines whether this circle overlaps any other {@link Shape} — another
   * circle, a {@link Rectangle}, or a {@link Polygon}. Shapes that touch count
   * as intersecting. For the circle-vs-circle case prefer the typed
   * {@link Circle.intersectsCircle}; this method is the polymorphic entry
   * point used when the other shape's type isn't known statically.
   *
   * @param other The shape to test against.
   * @param offset The position of `other`'s local origin relative to this
   * circle's center.
   */
  public intersects(other: Shape, offset: PointPrimitive): boolean {
    return shapesIntersect(this, other, offset);
  }

  /**
   * Returns the {@link Rectangle} size that tightly bounds this circle
   * (`diameter` × `diameter`), centered on the circle's origin.
   */
  public getBoundingBox(): Rectangle {
    // Late-bound `require` to break the circle -> rectangle -> polygon module
    // init cycle (Rectangle extends Polygon, which imports the shared
    // intersection helper that imports Circle). Mirrors Polygon.getBoundingBox.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const rectangleModule =
      require('./rectangle') as typeof import('./rectangle');
    /* eslint-enable @typescript-eslint/no-require-imports */

    return new rectangleModule.Rectangle(this.diameter, this.diameter);
  }

  /**
   * Returns a copy of this circle.
   */
  public clone(): Circle {
    return new Circle(this.radius);
  }

  /**
   * Returns a string representation of this circle.
   */
  public toString(): string {
    return `Circle(r=${this.radius.toFixed(2)})`;
  }
}
