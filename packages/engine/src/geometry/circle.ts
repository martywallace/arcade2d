import type { PointPrimitive } from './point.types';
import { Rectangle } from './rectangle';

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
 * A negative `radius` is treated as having no area for containment and
 * intersection purposes.
 */
export class Circle {
  /**
   * @param radius The radius of the circle. Expected to be non-negative.
   */
  constructor(public readonly radius = 0) {}

  /**
   * The distance across the circle through its center (`radius * 2`).
   */
  public get diameter(): number {
    return this.radius * 2;
  }

  /**
   * The distance around the circle (`2πr`).
   */
  public get circumference(): number {
    return this.radius * 2 * Math.PI;
  }

  /**
   * The area enclosed by the circle (`πr²`).
   */
  public get area(): number {
    return Math.PI * this.radius ** 2;
  }

  /**
   * Determines whether a point lies inside this circle. The point is expressed
   * in the circle's local space (relative to its center). A point exactly on
   * the edge is treated as contained.
   *
   * @param point The point to test, relative to the circle's center.
   */
  public containsPoint(point: PointPrimitive): boolean {
    return point.x ** 2 + point.y ** 2 <= this.radius ** 2;
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
    const combined = this.radius + other.radius;

    return offset.x ** 2 + offset.y ** 2 <= combined ** 2;
  }

  /**
   * Returns the {@link Rectangle} size that tightly bounds this circle
   * (`diameter` × `diameter`), centered on the circle's origin.
   */
  public getBoundingBox(): Rectangle {
    return new Rectangle(this.diameter, this.diameter);
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
