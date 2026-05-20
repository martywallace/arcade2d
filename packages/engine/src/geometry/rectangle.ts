import type { ImmutablePointPrimitive, PointPrimitive } from './point.types';
import { Polygon } from './polygon';

/**
 * Defines an axis-aligned rectangle as a pure shape, described by its `width`
 * and `height`. Like every shape it is positionless; its local space is
 * anchored at the top-left corner `0,0` and extends to `width,height`. Because
 * the engine uses screen-space coordinates, "top" is the smaller `y`.
 *
 * `width` and `height` are expected to be non-negative; the edge accessors and
 * containment tests assume this.
 */
export class Rectangle extends Polygon<
  [PointPrimitive, PointPrimitive, PointPrimitive, PointPrimitive]
> {
  /**
   * @param width The width of the rectangle.
   * @param height The height of the rectangle.
   */
  constructor(
    public readonly width: number,
    public readonly height: number,
  ) {
    super([
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ]);
  }

  /**
   * The x coordinate of the left edge (always `0` in local space).
   */
  public get left(): number {
    return 0;
  }

  /**
   * The x coordinate of the right edge.
   */
  public get right(): number {
    return this.width;
  }

  /**
   * The y coordinate of the top edge (always `0` in local space).
   */
  public get top(): number {
    return 0;
  }

  /**
   * The y coordinate of the bottom edge.
   */
  public get bottom(): number {
    return this.height;
  }

  /**
   * The top-left corner (the local origin).
   */
  public get topLeft(): ImmutablePointPrimitive {
    return this.points[0];
  }

  /**
   * The top-right corner.
   */
  public get topRight(): ImmutablePointPrimitive {
    return this.points[1];
  }

  /**
   * The bottom-right corner.
   */
  public get bottomRight(): ImmutablePointPrimitive {
    return this.points[2];
  }

  /**
   * The bottom-left corner.
   */
  public get bottomLeft(): ImmutablePointPrimitive {
    return this.points[3];
  }

  /**
   * Determines whether a point lies within this rectangle. The point is
   * expressed in the rectangle's local space (origin at the top-left corner).
   * Points on an edge are treated as contained.
   *
   * @param point The point to test, in the rectangle's local space.
   */
  public override containsPoint(point: PointPrimitive): boolean {
    return (
      point.x >= 0 &&
      point.x <= this.width &&
      point.y >= 0 &&
      point.y <= this.height
    );
  }

  /**
   * Determines whether this rectangle overlaps another rectangle. Rectangles
   * that touch only at an edge or corner are considered intersecting.
   *
   * @param other The rectangle to test against.
   * @param offset The position of `other`'s top-left corner relative to this
   * rectangle's top-left corner.
   */
  public intersects(other: Rectangle, offset: PointPrimitive): boolean {
    return (
      offset.x <= this.width &&
      offset.x + other.width >= 0 &&
      offset.y <= this.height &&
      offset.y + other.height >= 0
    );
  }
}
