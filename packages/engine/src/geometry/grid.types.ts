import type { Cell } from './cell';
import type { PointPrimitive } from './point.types';

/**
 * Factory invoked once per cell when a {@link Grid} is constructed, used to
 * seed each cell's {@link Cell.data} payload. Return `null` to leave a cell
 * empty.
 *
 * @param x The column (x coordinate) of the cell being seeded.
 * @param y The row (y coordinate) of the cell being seeded.
 * @returns The initial data for the cell, or `null` for an empty cell.
 */
export type GridInit<TData> = (x: number, y: number) => TData | null;

/**
 * The three distance metrics a {@link Grid} understands, each appropriate to a
 * different movement model:
 *
 * - `'manhattan'` — sum of the axis deltas (`|dx| + |dy|`). The grid distance
 *   when movement is restricted to the four orthogonal directions. Produces
 *   diamond-shaped regions.
 * - `'chebyshev'` — the larger axis delta (`max(|dx|, |dy|)`). The grid
 *   distance when diagonal movement is free. Produces square regions.
 * - `'euclidean'` — straight-line distance (`hypot(dx, dy)`). Produces circular
 *   regions; useful for blast radii and falloff rather than step counts.
 *
 * @see {@link WithinOptions.metric}
 */
export type GridMetric = 'manhattan' | 'chebyshev' | 'euclidean';

/**
 * A pathfinding heuristic — an estimate of the remaining cost from `a` to `b`.
 * To keep A*'s result optimal the estimate must be *admissible* (never greater
 * than the true cost) and *consistent*. The built-in
 * {@link manhattan}/{@link octile} helpers satisfy both for unit step costs.
 *
 * @param a The cell currently being expanded.
 * @param b The pathfinding target.
 * @returns The estimated remaining cost from `a` to `b`.
 */
export type GridHeuristic = (a: PointPrimitive, b: PointPrimitive) => number;

/**
 * Controls how neighbouring cells are enumerated by {@link Cell.neighbors} and,
 * by extension, the moves A* considers in {@link Grid.findPath}.
 */
export interface NeighborOptions {
  /**
   * When `true`, the four diagonal cells are included alongside the four
   * orthogonal ones, giving 8-connectivity. Defaults to `false`
   * (4-connectivity).
   */
  diagonal?: boolean;

  /**
   * When `true`, lookups that fall off an edge wrap around to the opposite
   * edge (the grid behaves as a torus) instead of being dropped. Defaults to
   * `false`.
   */
  wrap?: boolean;
}

/**
 * Options for {@link Grid.findPath}. Extends {@link NeighborOptions} so the
 * same `diagonal`/`wrap` connectivity rules govern which moves the search may
 * make.
 *
 * By default the search reads walkability and movement cost straight off each
 * cell's {@link Cell.passable} and {@link Cell.cost} metadata. The optional
 * callbacks override that per call without mutating the grid — pass an
 * `isPassable` that consults a separate mask, a line-of-sight check, or a
 * unit's movement rules.
 */
export interface PathfindingOptions<TData> extends NeighborOptions {
  /**
   * Predicate deciding whether the search may step *into* a cell. Defaults to
   * reading {@link Cell.passable}. The `start` cell is always a valid origin
   * even when this returns `false`; the `end` cell must satisfy it or the path
   * is unreachable.
   */
  isPassable?: (cell: Cell<TData>) => boolean;

  /**
   * Returns the cost of stepping *into* a cell. Defaults to reading
   * {@link Cell.cost}. Higher values make the search route around a cell;
   * values must be positive. For diagonal moves the cost is scaled by `√2`.
   */
  cost?: (cell: Cell<TData>) => number;

  /**
   * Overrides the remaining-cost estimate. Defaults to {@link manhattan} for
   * orthogonal movement and {@link octile} when `diagonal` is enabled.
   */
  heuristic?: GridHeuristic;
}

/**
 * Options for {@link Grid.within}, the radius/area query.
 */
export interface WithinOptions {
  /**
   * Which {@link GridMetric} defines the radius. Defaults to `'manhattan'`
   * (a diamond), matching 4-connected movement.
   */
  metric?: GridMetric;

  /**
   * Whether the centre cell is included in the result. Defaults to `true`.
   */
  includeCenter?: boolean;

  /**
   * When `true`, the area wraps across grid edges (toroidal). Defaults to
   * `false`.
   */
  wrap?: boolean;
}
