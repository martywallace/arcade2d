import RAPIER from '@dimforge/rapier2d-compat';
import type { ColliderDesc } from '@dimforge/rapier2d-compat';
import { Circle, Polygon, Rectangle } from '../geometry';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import type { Capsule, ColliderShape } from './rigid-body.types';

/**
 * Narrows a {@link ColliderShape} to a {@link Capsule} descriptor. Capsule is
 * a plain options object (not a geometry class), so it's identified
 * structurally — after the geometry-class `instanceof` checks have been ruled
 * out.
 */
function isCapsule(shape: ColliderShape): shape is Capsule {
  return (
    typeof shape === 'object' &&
    'halfHeight' in shape &&
    'radius' in shape &&
    !(shape instanceof Circle)
  );
}

/**
 * Converts an arcade2d {@link ColliderShape} into the Rapier `ColliderDesc`
 * the simulation consumes. All dimensions are pixels and the shape is centered
 * on the host's local origin (see {@link ColliderShape} for the anchoring
 * rules).
 *
 * The mapping is:
 *
 * | arcade2d shape | Rapier collider |
 * | --- | --- |
 * | {@link Circle} | `ball(radius)` |
 * | {@link Rectangle} | `cuboid(width / 2, height / 2)` — centered |
 * | {@link Polygon} | `convexHull(points)` — the convex hull of the vertices |
 * | {@link Capsule} | `capsule(halfHeight, radius)` |
 *
 * {@link Rectangle} is checked before {@link Polygon} because it extends it.
 * Note that a non-convex {@link Polygon} is reduced to its convex hull — Rapier
 * has no concave primitive collider.
 *
 * @param shape The arcade2d shape to convert.
 * @returns The equivalent Rapier `ColliderDesc`.
 * @throws {@link EngineError} with code
 *   {@link ErrorCode.PHYSICS_INVALID_SHAPE} when the shape is degenerate: a
 *   non-positive radius/extent, a capsule with a non-positive measurement, a
 *   polygon with fewer than three vertices, or a polygon whose hull Rapier
 *   rejects as collinear/empty.
 *
 * @internal
 */
export function toColliderDesc(shape: ColliderShape): ColliderDesc {
  if (shape instanceof Circle) {
    if (shape.radius <= 0) {
      throwEngineError(
        ErrorCode.PHYSICS_INVALID_SHAPE,
        `Circle collider needs a positive radius, got ${shape.radius}.`,
        { shape },
      );
    }

    return RAPIER.ColliderDesc.ball(shape.radius);
  }

  // Rectangle extends Polygon, so it must be tested first.
  if (shape instanceof Rectangle) {
    if (shape.width <= 0 || shape.height <= 0) {
      throwEngineError(
        ErrorCode.PHYSICS_INVALID_SHAPE,
        `Rectangle collider needs positive width and height, got ` +
          `${shape.width}x${shape.height}.`,
        { shape },
      );
    }

    return RAPIER.ColliderDesc.cuboid(shape.width / 2, shape.height / 2);
  }

  if (shape instanceof Polygon) {
    if (shape.points.length < 3) {
      throwEngineError(
        ErrorCode.PHYSICS_INVALID_SHAPE,
        `Polygon collider needs at least three vertices, got ` +
          `${shape.points.length}.`,
        { shape },
      );
    }

    const vertices = new Float32Array(shape.points.length * 2);

    for (let i = 0; i < shape.points.length; i++) {
      const point = shape.points[i]!;
      vertices[i * 2] = point.x;
      vertices[i * 2 + 1] = point.y;
    }

    const desc = RAPIER.ColliderDesc.convexHull(vertices);

    if (desc === null) {
      throwEngineError(
        ErrorCode.PHYSICS_INVALID_SHAPE,
        'Polygon collider vertices do not form a valid convex hull (they may ' +
          'be collinear or duplicated).',
        { shape },
      );
    }

    return desc;
  }

  if (isCapsule(shape)) {
    if (shape.halfHeight <= 0 || shape.radius <= 0) {
      throwEngineError(
        ErrorCode.PHYSICS_INVALID_SHAPE,
        `Capsule collider needs a positive halfHeight and radius, got ` +
          `${shape.halfHeight} / ${shape.radius}.`,
        { shape },
      );
    }

    return RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
  }

  // Exhaustive: every ColliderShape variant is handled above.
  return throwEngineError(
    ErrorCode.PHYSICS_INVALID_SHAPE,
    'Unrecognised collider shape.',
    { shape },
  );
}
