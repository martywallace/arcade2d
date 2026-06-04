import { shapesIntersect } from './intersection.support';
import type { ImmutablePointPrimitive, PointPrimitive } from './point.types';
import type { PolygonBounds } from './polygon.types';
import type { Rectangle } from './rectangle';
import type { Shape } from './shape.types';

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
> implements Shape {
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

    // Single pass, no intermediate arrays or argument spreading: `Math.min`
    // via spread would both allocate and risk a call-stack overflow on a
    // polygon with very many vertices.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of this.points) {
      if (point.x < minX) {
        minX = point.x;
      }
      if (point.y < minY) {
        minY = point.y;
      }
      if (point.x > maxX) {
        maxX = point.x;
      }
      if (point.y > maxY) {
        maxY = point.y;
      }
    }

    return {
      min: Object.freeze({ x: minX, y: minY }),
      max: Object.freeze({ x: maxX, y: maxY }),
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

    // Late-bound `require` to break the polygon ↔ rectangle module-init
    // cycle: Rectangle extends Polygon, so importing it at the top of this
    // file would force rectangle.ts to evaluate before Polygon is defined.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const rectangleModule =
      require('./rectangle') as typeof import('./rectangle');
    /* eslint-enable @typescript-eslint/no-require-imports */

    return new rectangleModule.Rectangle(max.x - min.x, max.y - min.y);
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

  /**
   * Determines whether this polygon overlaps any other {@link Shape} — a
   * {@link Circle}, a {@link Rectangle}, or another polygon — using a
   * separating-axis test (or the analytic circle test for a circle). Shapes
   * that touch count as intersecting.
   *
   * Assumes both shapes are **convex**; results for a concave polygon are
   * undefined, matching the rest of this class's measurement contract.
   *
   * @param other The shape to test against.
   * @param offset The position of `other`'s local origin relative to this
   * polygon's local origin.
   */
  public intersects(other: Shape, offset: PointPrimitive): boolean {
    return shapesIntersect(this, other, offset);
  }

  /**
   * Returns an independent copy of this polygon with its own vertex array.
   */
  public clone(): Polygon<TPointTuple> {
    return new Polygon([...this.points] as unknown as TPointTuple);
  }

  /**
   * Returns a string representation of this polygon (its vertex count).
   */
  public toString(): string {
    return `Polygon(${this.points.length} points)`;
  }
}
