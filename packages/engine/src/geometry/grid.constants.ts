/**
 * The default movement cost of stepping into a {@link Cell} — used by
 * {@link Grid.findPath} unless overridden per cell ({@link Cell.cost}) or per
 * call ({@link PathfindingOptions.cost}). A uniform cost of `1` makes the
 * search count steps.
 */
export const DEFAULT_CELL_COST = 1;

/**
 * Whether a {@link Cell} is walkable by default. Cells start passable; mark the
 * walls impassable rather than the floors passable.
 */
export const DEFAULT_CELL_PASSABLE = true;

/**
 * The four orthogonal `[dx, dy]` offsets, in screen-space order
 * (up = `-y`, down = `+y`): up, right, down, left. Used to enumerate
 * 4-connected neighbours.
 *
 * @internal
 */
export const ORTHOGONAL_OFFSETS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/**
 * The four diagonal `[dx, dy]` offsets: up-right, down-right, down-left,
 * up-left. Appended to {@link ORTHOGONAL_OFFSETS} for 8-connected neighbours.
 *
 * @internal
 */
export const DIAGONAL_OFFSETS: readonly (readonly [number, number])[] = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;
