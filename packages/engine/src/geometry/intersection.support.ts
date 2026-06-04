import { Circle } from './circle';
import type { PointPrimitive } from './point.types';
import { Polygon } from './polygon';
import type { Shape } from './shape.types';

/**
 * Tests whether two {@link Shape}s overlap, given the position of `b`'s local
 * origin relative to `a`'s. This is the dispatch backing every shape's
 * {@link Shape.intersects} method: it picks the right analytic or SAT test for
 * the concrete pair (circle/circle, circle/polygon, polygon/polygon —
 * {@link Rectangle} counts as a polygon).
 *
 * Touching shapes count as intersecting. Polygon tests assume convex inputs;
 * a concave polygon yields undefined results, matching the rest of the
 * {@link Polygon} measurement contract.
 *
 * @param a The first shape (its local origin is the frame of reference).
 * @param b The second shape.
 * @param offset The position of `b`'s local origin relative to `a`'s.
 */
export function shapesIntersect(
  a: Shape,
  b: Shape,
  offset: PointPrimitive,
): boolean {
  const aIsCircle = a instanceof Circle;
  const bIsCircle = b instanceof Circle;

  if (aIsCircle && bIsCircle) {
    return a.intersectsCircle(b, offset);
  }

  // Circle vs polygon reduces to "is the circle's centre within `radius` of
  // the polygon?" — expressed in the polygon's local frame.
  if (aIsCircle && b instanceof Polygon) {
    return circlePolygonIntersect(a.radius, { x: -offset.x, y: -offset.y }, b);
  }

  if (a instanceof Polygon && bIsCircle) {
    return circlePolygonIntersect(b.radius, offset, a);
  }

  if (a instanceof Polygon && b instanceof Polygon) {
    return polygonsIntersect(a, b, offset);
  }

  return false;
}

/**
 * Whether a circle of `radius` centred at `center` (in the polygon's local
 * space) overlaps `polygon`. True when the centre is inside the polygon or
 * within `radius` of any edge. A negative radius is clamped to zero.
 */
function circlePolygonIntersect(
  radius: number,
  center: PointPrimitive,
  polygon: Polygon,
): boolean {
  const r = Math.max(0, radius);
  const points = polygon.points;

  if (points.length === 0) {
    return false;
  }

  if (polygon.containsPoint(center)) {
    return true;
  }

  let minDistanceSq = Infinity;
  let prev = points[points.length - 1]!;

  for (const current of points) {
    const distanceSq = pointToSegmentDistanceSq(center, prev, current);

    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq;
    }

    prev = current;
  }

  return minDistanceSq <= r * r;
}

/**
 * Separating-axis test between two convex polygons. `b`'s vertices are shifted
 * by `offset` into `a`'s local frame; the polygons overlap when no edge normal
 * of either separates them.
 */
function polygonsIntersect(
  a: Polygon,
  b: Polygon,
  offset: PointPrimitive,
): boolean {
  if (a.points.length === 0 || b.points.length === 0) {
    return false;
  }

  const aVertices = a.points;
  const bVertices = b.points.map((point) => ({
    x: point.x + offset.x,
    y: point.y + offset.y,
  }));

  return (
    !hasSeparatingAxis(aVertices, bVertices) &&
    !hasSeparatingAxis(bVertices, aVertices)
  );
}

/**
 * Whether any edge normal of `source` separates `source` from `target` — i.e.
 * their projections onto that axis leave a gap. A zero-length edge contributes
 * no usable axis and is skipped.
 */
function hasSeparatingAxis(
  source: readonly PointPrimitive[],
  target: readonly PointPrimitive[],
): boolean {
  const count = source.length;

  for (let i = 0; i < count; i += 1) {
    const start = source[i]!;
    const end = source[(i + 1) % count]!;

    // The outward normal of edge start->end. Magnitude is irrelevant to the
    // overlap test, so it's left un-normalised.
    const axisX = -(end.y - start.y);
    const axisY = end.x - start.x;

    if (axisX === 0 && axisY === 0) {
      continue;
    }

    const [minSource, maxSource] = projectOntoAxis(source, axisX, axisY);
    const [minTarget, maxTarget] = projectOntoAxis(target, axisX, axisY);

    // A strict gap means the axis separates them. Touching (max === min)
    // counts as intersecting, matching the rest of the geometry contract.
    if (maxSource < minTarget || maxTarget < minSource) {
      return true;
    }
  }

  return false;
}

/**
 * Projects every vertex onto the axis `(axisX, axisY)` and returns the
 * `[min, max]` scalar extent of the projection.
 */
function projectOntoAxis(
  vertices: readonly PointPrimitive[],
  axisX: number,
  axisY: number,
): [number, number] {
  let min = Infinity;
  let max = -Infinity;

  for (const vertex of vertices) {
    const projection = vertex.x * axisX + vertex.y * axisY;

    if (projection < min) {
      min = projection;
    }
    if (projection > max) {
      max = projection;
    }
  }

  return [min, max];
}

/**
 * Squared distance from point `p` to the segment `a`-`b`. Squared to avoid a
 * `sqrt` in the hot path — callers compare against a squared radius.
 */
function pointToSegmentDistanceSq(
  p: PointPrimitive,
  a: PointPrimitive,
  b: PointPrimitive,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  // Degenerate segment (a === b): distance to the point.
  if (lengthSq === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;

    return px * px + py * py;
  }

  // Parametric projection of p onto the segment, clamped to [0, 1].
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  const ox = p.x - closestX;
  const oy = p.y - closestY;

  return ox * ox + oy * oy;
}
