import { ImmutablePointPrimitive, PointPrimitive } from './point';

/**
 * The local-space axis-aligned extents of a {@link Polygon}, as the minimum
 * and maximum corner. Both corners are frozen.
 */
export interface PolygonBounds {
  readonly min: ImmutablePointPrimitive;
  readonly max: ImmutablePointPrimitive;
}

/**
 * Defines a polygon as a pure shape: an ordered ring of vertices in the
 * polygon's own local coordinate space. The polygon has no world position of
 * its own — its vertices are intrinsic shape data, and where the polygon sits
 * in the world is the responsibility of whatever owns it (e.g. a transform).
 * All queries therefore operate in this local space.
 *
 * The polygon is implicitly closed: the last vertex connects back to the
 * first. Polygons are immutable value objects — the vertex tuple is read-only
 * and derived measurements are computed on demand. Measurements assume a
 * simple (non-self-intersecting) ring; results are undefined otherwise.
 *
 * The engine uses screen-space coordinates, so `y` increases downward.
 *
 * @template TPointTuple - The tuple type of points that make up the polygon.
 */
export class Polygon<
  TPointTuple extends readonly PointPrimitive[] = readonly PointPrimitive[],
> {
  constructor(public readonly points: TPointTuple) {}

  /**
   * Returns the local-space axis-aligned extents of this polygon. An empty
   * polygon yields zero extents at the origin.
   */
  public getBounds(): PolygonBounds {
    if (this.points.length === 0) {
      return {
        min: Object.freeze({ x: 0, y: 0 }),
        max: Object.freeze({ x: 0, y: 0 }),
      };
    }

    const xs = this.points.map((point) => point.x);
    const ys = this.points.map((point) => point.y);

    return {
      min: Object.freeze({ x: Math.min(...xs), y: Math.min(...ys) }),
      max: Object.freeze({ x: Math.max(...xs), y: Math.max(...ys) }),
    };
  }

  /**
   * Returns the size of this polygon's bounding box as a pure
   * {@link Rectangle}. Because shapes are positionless, only the extents'
   * width and height are returned; use {@link Polygon.getBounds} for the local
   * min/max corners.
   */
  public getBoundingBox(): Rectangle {
    const { min, max } = this.getBounds();

    return new Rectangle(max.x - min.x, max.y - min.y);
  }

  /**
   * Returns the center of this polygon's bounding box, in local space. This is
   * *not* the area centroid — see {@link Polygon.getCentroid} for the
   * mass-weighted center.
   *
   * The returned primitive is frozen.
   */
  public getCenter(): ImmutablePointPrimitive {
    const { min, max } = this.getBounds();

    return Object.freeze({
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
    });
  }

  /**
   * Returns the area centroid (center of mass) of this polygon, in local
   * space. For polygons with fewer than three vertices, or a degenerate
   * (zero-area) ring, this falls back to the {@link Polygon.getCenter
   * bounding-box center}.
   *
   * The returned primitive is frozen.
   */
  public getCentroid(): ImmutablePointPrimitive {
    const seed = this.points.at(-1);

    if (this.points.length < 3 || !seed) {
      return this.getCenter();
    }

    let prev: PointPrimitive = seed;
    let signedArea = 0;
    let cx = 0;
    let cy = 0;

    for (const point of this.points) {
      const cross = prev.x * point.y - point.x * prev.y;

      signedArea += cross;
      cx += (prev.x + point.x) * cross;
      cy += (prev.y + point.y) * cross;
      prev = point;
    }

    if (signedArea === 0) {
      return this.getCenter();
    }

    return Object.freeze({
      x: cx / (3 * signedArea),
      y: cy / (3 * signedArea),
    });
  }

  /**
   * Returns the total length of this polygon's perimeter, including the
   * closing edge from the last vertex back to the first. A polygon with fewer
   * than two vertices has a perimeter of `0`.
   */
  public getPerimeter(): number {
    const seed = this.points.at(-1);

    if (this.points.length < 2 || !seed) {
      return 0;
    }

    let prev: PointPrimitive = seed;
    let perimeter = 0;

    for (const point of this.points) {
      perimeter += Math.sqrt((point.x - prev.x) ** 2 + (point.y - prev.y) ** 2);
      prev = point;
    }

    return perimeter;
  }

  /**
   * Returns the unsigned area enclosed by this polygon, computed via the
   * shoelace formula. A polygon with fewer than three vertices has an area of
   * `0`.
   */
  public getArea(): number {
    const seed = this.points.at(-1);

    if (this.points.length < 3 || !seed) {
      return 0;
    }

    let prev: PointPrimitive = seed;
    let sum = 0;

    for (const point of this.points) {
      sum += prev.x * point.y - point.x * prev.y;
      prev = point;
    }

    return Math.abs(sum) / 2;
  }

  /**
   * Determines whether a point lies inside this polygon using a ray-casting
   * test. The point is expressed in the polygon's local space. Points exactly
   * on an edge may return either result and should not be relied upon. Always
   * `false` for polygons with fewer than three vertices.
   *
   * @param point The point to test, in the polygon's local space.
   */
  public containsPoint(point: PointPrimitive): boolean {
    const seed = this.points.at(-1);

    if (this.points.length < 3 || !seed) {
      return false;
    }

    let prev: PointPrimitive = seed;
    let inside = false;

    for (const current of this.points) {
      if (current.y > point.y !== prev.y > point.y) {
        const intersectX =
          ((prev.x - current.x) * (point.y - current.y)) /
            (prev.y - current.y) +
          current.x;

        if (point.x < intersectX) {
          inside = !inside;
        }
      }

      prev = current;
    }

    return inside;
  }
}

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
