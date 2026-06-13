import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import {
  DEFAULT_CELL_COST,
  DEFAULT_CELL_PASSABLE,
  DIAGONAL_OFFSETS,
  ORTHOGONAL_OFFSETS,
} from './grid.constants';
import type { NeighborOptions } from './grid.types';
import { Point } from './point';
import type { PointPrimitive } from './point.types';
import type { Grid } from './grid';

/**
 * A single addressable position in a {@link Grid}, carrying both gameplay data
 * and the metadata the grid's algorithms read.
 *
 * ### Cell is-a Point
 *
 * `Cell` extends {@link Point}, so its `x`/`y` *are* its column/row in the grid
 * and every read-only point query works between cells out of the box —
 * {@link Point.distanceTo}, {@link Point.angleTo}, {@link Point.equals},
 * {@link Point.dot}, and so on. For grid-native step counts, prefer
 * {@link Cell.manhattanDistanceTo} / {@link Cell.chebyshevDistanceTo} over the
 * inherited Euclidean {@link Point.distanceTo}.
 *
 * ### Coordinates are immutable
 *
 * A cell's coordinate is its identity within the grid index, so it cannot
 * change. Writing `cell.x`/`cell.y` — or calling any of `Point`'s in-place
 * vector mutators (`add`, `scale`, `forward`, `lerp`, …), which assign through
 * those setters — throws an {@link EngineError} with
 * {@link ErrorCode.GRID_CELL_IMMUTABLE}. To do vector math, take a detached
 * copy first: {@link Point.clone} returns a plain, mutable `Point`.
 *
 * ### Data and metadata
 *
 * - {@link Cell.data} is the arbitrary gameplay payload (a wall, an actor, an
 *   item, …) — set it, read it, clear it to `null`.
 * - {@link Cell.passable} and {@link Cell.cost} are the defaults
 *   {@link Grid.findPath} reads. Mark walls `passable = false`; raise `cost` to
 *   make the search route around difficult terrain.
 *
 * Cells are created by their owning {@link Grid}; you never construct one
 * directly. Resolve them with {@link Grid.cellAt} and navigate with
 * {@link Cell.neighbors} / {@link Cell.left} and friends.
 *
 * @example
 * ```typescript
 * const grid = new Grid<'wall' | 'floor'>(10, 10, () => 'floor');
 * const cell = grid.cellAt(2, 3)!;
 *
 * cell.data = 'wall';
 * cell.passable = false;
 *
 * const right = cell.right();        // Cell | null
 * const reach = cell.manhattanDistanceTo({ x: 5, y: 3 }); // 3
 *
 * const detached = cell.clone().add(1, 0); // plain Point; cell is untouched
 * ```
 *
 * @typeParam TData The type of gameplay payload stored on the cell.
 */
export class Cell<TData = unknown> extends Point {
  /**
   * The arbitrary gameplay payload occupying this cell, or `null` when the
   * cell is empty. Mutable: assign to populate, set to `null` to clear.
   */
  public data: TData | null;

  /**
   * Whether the cell may be stepped into. Consumed by {@link Grid.findPath} as
   * the default walkability test (overridable per call via
   * {@link PathfindingOptions.isPassable}). Defaults to
   * {@link DEFAULT_CELL_PASSABLE}.
   */
  public passable: boolean = DEFAULT_CELL_PASSABLE;

  /**
   * The cost of stepping *into* this cell, read by {@link Grid.findPath} as the
   * default movement cost (overridable per call via
   * {@link PathfindingOptions.cost}). Must be positive. Defaults to
   * {@link DEFAULT_CELL_COST}.
   */
  public cost: number = DEFAULT_CELL_COST;

  /**
   * The {@link Grid} this cell belongs to. Used to resolve neighbours and wrap
   * coordinates; a cell can only ever be navigated within its own grid.
   */
  public readonly grid: Grid<TData>;

  /**
   * Cells are created by their owning {@link Grid} during construction; do not
   * instantiate directly.
   *
   * @param grid The grid that owns this cell.
   * @param x The column (x coordinate) of the cell.
   * @param y The row (y coordinate) of the cell.
   * @param data The initial payload, or `null` for an empty cell.
   * @internal
   */
  constructor(grid: Grid<TData>, x: number, y: number, data: TData | null) {
    super(x, y);

    this.grid = grid;
    this.data = data;
  }

  /**
   * Resolves the cell at a relative `[dx, dy]` offset from this one. The
   * primitive behind all the directional accessors.
   *
   * @param dx The column delta (positive is right).
   * @param dy The row delta (positive is down, matching screen-space).
   * @param wrap When `true`, offsets that fall off an edge wrap to the opposite
   * edge instead of yielding `null`. Defaults to `false`.
   * @returns The target cell, or `null` if it lies outside the grid and `wrap`
   * is `false`.
   */
  public offset(dx: number, dy: number, wrap = false): Cell<TData> | null {
    const tx = this.x + dx;
    const ty = this.y + dy;

    return wrap ? this.grid.wrap(tx, ty) : this.grid.cellAt(tx, ty);
  }

  /**
   * The cell `distance` columns to the left (toward smaller `x`).
   *
   * @param distance How many cells to move. Defaults to `1`.
   * @param wrap Whether to wrap across the left edge. Defaults to `false`.
   * @returns The target cell, or `null` if out of bounds and not wrapping.
   */
  public left(distance = 1, wrap = false): Cell<TData> | null {
    return this.offset(-distance, 0, wrap);
  }

  /**
   * The cell `distance` columns to the right (toward larger `x`).
   *
   * @param distance How many cells to move. Defaults to `1`.
   * @param wrap Whether to wrap across the right edge. Defaults to `false`.
   * @returns The target cell, or `null` if out of bounds and not wrapping.
   */
  public right(distance = 1, wrap = false): Cell<TData> | null {
    return this.offset(distance, 0, wrap);
  }

  /**
   * The cell `distance` rows up (toward smaller `y`, matching the engine's
   * screen-space convention where "up" is `-y`).
   *
   * @param distance How many cells to move. Defaults to `1`.
   * @param wrap Whether to wrap across the top edge. Defaults to `false`.
   * @returns The target cell, or `null` if out of bounds and not wrapping.
   */
  public up(distance = 1, wrap = false): Cell<TData> | null {
    return this.offset(0, -distance, wrap);
  }

  /**
   * The cell `distance` rows down (toward larger `y`).
   *
   * @param distance How many cells to move. Defaults to `1`.
   * @param wrap Whether to wrap across the bottom edge. Defaults to `false`.
   * @returns The target cell, or `null` if out of bounds and not wrapping.
   */
  public down(distance = 1, wrap = false): Cell<TData> | null {
    return this.offset(0, distance, wrap);
  }

  /**
   * The cells adjacent to this one. Orthogonal (4-connected) by default; pass
   * `{ diagonal: true }` for the 8-connected ring. Out-of-bounds neighbours are
   * dropped unless `{ wrap: true }` is given, in which case they wrap across
   * edges (this cell itself is never returned).
   *
   * @param options Connectivity and wrapping. See {@link NeighborOptions}.
   * @returns The neighbouring cells, orthogonals first then diagonals.
   *
   * @example
   * ```typescript
   * const orthogonal = cell.neighbors();                  // up to 4
   * const all = cell.neighbors({ diagonal: true });       // up to 8
   * const open = cell.neighbors().filter((c) => c.passable);
   * ```
   */
  public neighbors(options: NeighborOptions = {}): Cell<TData>[] {
    const offsets = options.diagonal
      ? [...ORTHOGONAL_OFFSETS, ...DIAGONAL_OFFSETS]
      : ORTHOGONAL_OFFSETS;
    const wrap = options.wrap ?? false;
    const result: Cell<TData>[] = [];

    for (const [dx, dy] of offsets) {
      const neighbor = this.offset(dx, dy, wrap);

      // With wrapping on a tiny grid an offset can resolve back to this cell;
      // a cell is never its own neighbour.
      if (neighbor !== null && neighbor !== this) {
        result.push(neighbor);
      }
    }

    return result;
  }

  /**
   * The Manhattan (taxicab) distance to a target — `|dx| + |dy|`. This is the
   * step count between cells under 4-connected movement.
   *
   * @param target The cell or coordinate to measure to.
   */
  public manhattanDistanceTo(target: PointPrimitive): number {
    return Math.abs(this.x - target.x) + Math.abs(this.y - target.y);
  }

  /**
   * The Chebyshev (chessboard) distance to a target — `max(|dx|, |dy|)`. This
   * is the step count between cells under 8-connected movement, where a
   * diagonal step costs the same as an orthogonal one.
   *
   * @param target The cell or coordinate to measure to.
   */
  public chebyshevDistanceTo(target: PointPrimitive): number {
    return Math.max(Math.abs(this.x - target.x), Math.abs(this.y - target.y));
  }

  /**
   * Returns a string representation of this cell (its grid coordinate).
   */
  public override toString(): string {
    return `Cell(${this.x}, ${this.y})`;
  }

  /**
   * The column (x coordinate) of this cell. Read-only — see the class docs on
   * coordinate immutability.
   */
  public override get x(): number {
    return super.x;
  }

  /**
   * @throws An {@link EngineError} with {@link ErrorCode.GRID_CELL_IMMUTABLE}
   * — a cell's coordinate is its grid identity and cannot be reassigned.
   */
  public override set x(_value: number) {
    throwEngineError(
      ErrorCode.GRID_CELL_IMMUTABLE,
      'A Cell coordinate is immutable; clone() the cell to a Point for vector math.',
      { cell: this, axis: 'x' },
    );
  }

  /**
   * The row (y coordinate) of this cell. Read-only — see the class docs on
   * coordinate immutability.
   */
  public override get y(): number {
    return super.y;
  }

  /**
   * @throws An {@link EngineError} with {@link ErrorCode.GRID_CELL_IMMUTABLE}
   * — a cell's coordinate is its grid identity and cannot be reassigned.
   */
  public override set y(_value: number) {
    throwEngineError(
      ErrorCode.GRID_CELL_IMMUTABLE,
      'A Cell coordinate is immutable; clone() the cell to a Point for vector math.',
      { cell: this, axis: 'y' },
    );
  }

  /**
   * Whether this cell holds no {@link Cell.data} (`data === null`).
   */
  public get empty(): boolean {
    return this.data === null;
  }
}
