import type { ImmutablePointPrimitive } from './point.types';

/**
 * The local-space axis-aligned extents of a {@link Polygon}, as the minimum
 * and maximum corner. Both corners are frozen.
 */
export interface PolygonBounds {
  readonly min: ImmutablePointPrimitive;
  readonly max: ImmutablePointPrimitive;
}
