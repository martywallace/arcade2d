import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { Cell } from './cell';
import { findPath } from './grid.support';
import type {
  GridInit,
  GridMetric,
  PathfindingOptions,
  WithinOptions,
} from './grid.types';
import type { PointPrimitive } from './point.types';

/**
 * A fixed-size rectangular lattice of {@link Cell}s addressed by integer
 * `x` (column) / `y` (row) coordinates — the backbone for tile maps, board
 * games, tactics movement, fog-of-war, and anything else that reasons about
 * discrete positions.
 *
 * ### Coordinate model
 *
 * The grid is `width` columns by `height` rows. `x` runs `0 … width - 1` left
 * to right; `y` runs `0 … height - 1` top to bottom, matching the engine's
 * screen-space convention (so {@link Cell.up} moves toward smaller `y`). Every
 * position is named in `x, y` order throughout — never `row, column`.
 *
 * ### Fixed size, stable cells
 *
 * Dimensions are immutable: there is no adding or removing rows. Each cell is
 * created once at construction and lives for the grid's lifetime, so cell
 * references stay valid and reference-equality (`===`) is a reliable identity
 * check — {@link Grid.cellAt} returns the *same* `Cell` instance every time.
 *
 * ### Lookups never throw
 *
 * {@link Grid.cellAt} returns `null` for out-of-bounds coordinates rather than
 * throwing, so callers branch on the result. {@link Grid.clamp} and
 * {@link Grid.wrap} always resolve to a real cell by folding the coordinate
 * back in range.
 *
 * ### Navigation, queries, and pathfinding
 *
 * Walk locally with {@link Cell.neighbors} and {@link Cell.left}/`right`/`up`/
 * `down`; sweep areas with {@link Grid.line} (Bresenham) and
 * {@link Grid.within} (radius); and route with {@link Grid.findPath} (A*),
 * which reads {@link Cell.passable}/{@link Cell.cost} by default and accepts
 * per-call overrides.
 *
 * @example
 * ```typescript
 * type Tile = 'floor' | 'wall';
 *
 * // Seed every cell with floor, then wall off a column.
 * const grid = new Grid<Tile>(16, 12, () => 'floor');
 * for (let y = 0; y < grid.height; y++) {
 *   const cell = grid.cellAt(8, y)!;
 *   cell.data = 'wall';
 *   cell.passable = false;
 * }
 * grid.cellAt(8, 6)!.passable = true; // a gap in the wall
 *
 * const path = grid.findPath({ x: 1, y: 6 }, { x: 14, y: 6 });
 * // -> ordered Cells routing through the gap, or null if blocked
 * ```
 *
 * @typeParam TData The type of gameplay payload stored on each {@link Cell}.
 */
export class Grid<TData = unknown> {
  // Cells in row-major order; index = y * width + x. Built once, never resized.
  private readonly _cells: Cell<TData>[];

  /**
   * Creates a grid and all of its cells.
   *
   * @param width The number of columns. Must be a positive integer.
   * @param height The number of rows. Must be a positive integer.
   * @param init Optional factory run once per cell to seed {@link Cell.data};
   * receives the cell's `x, y` and returns its initial payload (or `null`).
   * When omitted, every cell starts empty (`data === null`).
   * @throws An {@link EngineError} with {@link ErrorCode.GRID_INVALID_SIZE} if
   * `width` or `height` is not a positive integer.
   */
  constructor(
    public readonly width: number,
    public readonly height: number,
    init?: GridInit<TData>,
  ) {
    if (!Grid._isPositiveInteger(width) || !Grid._isPositiveInteger(height)) {
      throwEngineError(
        ErrorCode.GRID_INVALID_SIZE,
        `A Grid's width and height must be positive integers (received ${width} x ${height}).`,
        { width, height },
      );
    }

    this._cells = new Array<Cell<TData>>(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this._cells[y * width + x] = new Cell<TData>(
          this,
          x,
          y,
          init ? init(x, y) : null,
        );
      }
    }
  }

  // True only for finite integers strictly greater than zero.
  private static _isPositiveInteger(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  /**
   * The total number of cells in the grid (`width * height`).
   */
  public get size(): number {
    return this.width * this.height;
  }

  /**
   * Resolves the cell at an integer coordinate.
   *
   * @param x The column.
   * @param y The row.
   * @returns The cell, or `null` if the coordinate is out of bounds or not an
   * integer.
   */
  public cellAt(x: number, y: number): Cell<TData> | null {
    if (!this.contains(x, y)) {
      return null;
    }

    return this._cells[y * this.width + x]!;
  }

  /**
   * Whether an integer coordinate lies within the grid.
   *
   * @param x The column.
   * @param y The row.
   */
  public contains(x: number, y: number): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < this.width &&
      y >= 0 &&
      y < this.height
    );
  }

  /**
   * Resolves the in-bounds cell nearest a coordinate by clamping each axis to
   * the grid's edges. Always returns a cell. Non-integer inputs are rounded.
   *
   * @param x The column (clamped to `0 … width - 1`).
   * @param y The row (clamped to `0 … height - 1`).
   */
  public clamp(x: number, y: number): Cell<TData> {
    const cx = Math.min(Math.max(Math.round(x), 0), this.width - 1);
    const cy = Math.min(Math.max(Math.round(y), 0), this.height - 1);

    return this._cells[cy * this.width + cx]!;
  }

  /**
   * Resolves a cell by wrapping the coordinate across the grid's edges, so the
   * grid behaves as a torus. Always returns a cell; negative and overflowing
   * coordinates fold back in range. Non-integer inputs are floored.
   *
   * @param x The column (wrapped modulo `width`).
   * @param y The row (wrapped modulo `height`).
   */
  public wrap(x: number, y: number): Cell<TData> {
    const wx = ((Math.floor(x) % this.width) + this.width) % this.width;
    const wy = ((Math.floor(y) % this.height) + this.height) % this.height;

    return this._cells[wy * this.width + wx]!;
  }

  /**
   * The cells of a single row, left to right.
   *
   * @param y The row index.
   * @returns The row's cells, or an empty array if `y` is out of bounds.
   */
  public row(y: number): Cell<TData>[] {
    if (!Number.isInteger(y) || y < 0 || y >= this.height) {
      return [];
    }

    const start = y * this.width;

    return this._cells.slice(start, start + this.width);
  }

  /**
   * The cells of a single column, top to bottom.
   *
   * @param x The column index.
   * @returns The column's cells, or an empty array if `x` is out of bounds.
   */
  public column(x: number): Cell<TData>[] {
    if (!Number.isInteger(x) || x < 0 || x >= this.width) {
      return [];
    }

    const result: Cell<TData>[] = [];

    for (let y = 0; y < this.height; y++) {
      result.push(this._cells[y * this.width + x]!);
    }

    return result;
  }

  /**
   * Iterates every cell in row-major order (row 0 left-to-right, then row 1,
   * and so on), making the grid spreadable and `for…of`-able.
   *
   * @example
   * ```typescript
   * for (const cell of grid) {
   *   if (cell.empty) cell.data = 'floor';
   * }
   * const all = [...grid];
   * ```
   */
  public *[Symbol.iterator](): IterableIterator<Cell<TData>> {
    yield* this._cells;
  }

  /**
   * Runs a callback for every cell in row-major order.
   *
   * @param callback Invoked with each cell and its `x, y` coordinate.
   */
  public forEach(
    callback: (cell: Cell<TData>, x: number, y: number) => void,
  ): void {
    for (const cell of this._cells) {
      callback(cell, cell.x, cell.y);
    }
  }

  /**
   * Maps every cell to a value, in row-major order.
   *
   * @param callback Invoked with each cell and its `x, y` coordinate.
   * @returns The mapped values.
   */
  public map<R>(callback: (cell: Cell<TData>, x: number, y: number) => R): R[] {
    return this._cells.map((cell) => callback(cell, cell.x, cell.y));
  }

  /**
   * Collects every cell matching a predicate, in row-major order.
   *
   * @param predicate Invoked with each cell and its `x, y` coordinate.
   * @returns The matching cells.
   */
  public filter(
    predicate: (cell: Cell<TData>, x: number, y: number) => boolean,
  ): Cell<TData>[] {
    return this._cells.filter((cell) => predicate(cell, cell.x, cell.y));
  }

  /**
   * Finds the first cell matching a predicate, in row-major order.
   *
   * @param predicate Invoked with each cell and its `x, y` coordinate.
   * @returns The first matching cell, or `null` if none match.
   */
  public find(
    predicate: (cell: Cell<TData>, x: number, y: number) => boolean,
  ): Cell<TData> | null {
    return this._cells.find((cell) => predicate(cell, cell.x, cell.y)) ?? null;
  }

  /**
   * Traces a straight line of cells between two coordinates using Bresenham's
   * algorithm — the basis for line-of-sight, ray casts, and beam effects.
   * Endpoints are inclusive; cells that fall outside the grid are skipped.
   *
   * @param from The starting coordinate.
   * @param to The ending coordinate.
   * @returns The in-bounds cells along the line, ordered from `from` to `to`.
   *
   * @example
   * ```typescript
   * const sight = grid.line(archer, target);
   * const blocked = sight.some((cell) => !cell.passable);
   * ```
   */
  public line(from: PointPrimitive, to: PointPrimitive): Cell<TData>[] {
    let x0 = Math.round(from.x);
    let y0 = Math.round(from.y);
    const x1 = Math.round(to.x);
    const y1 = Math.round(to.y);

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;

    const result: Cell<TData>[] = [];

    for (;;) {
      const cell = this.cellAt(x0, y0);
      if (cell !== null) {
        result.push(cell);
      }

      if (x0 === x1 && y0 === y1) {
        break;
      }

      const doubleError = 2 * error;
      if (doubleError >= dy) {
        error += dy;
        x0 += sx;
      }
      if (doubleError <= dx) {
        error += dx;
        y0 += sy;
      }
    }

    return result;
  }

  /**
   * Collects the cells within a given radius of a centre coordinate. The radius
   * is measured with the chosen {@link GridMetric}: `'manhattan'` (the default)
   * yields a diamond, `'chebyshev'` a square, and `'euclidean'` a disc.
   *
   * @param center The centre coordinate.
   * @param radius The inclusive radius; cells with `metric distance <= radius`
   * are included.
   * @param options Metric, centre inclusion, and edge wrapping. See
   * {@link WithinOptions}.
   * @returns The cells in range. When wrapping, each cell appears at most once.
   *
   * @example
   * ```typescript
   * const blast = grid.within(impact, 3, { metric: 'euclidean' });
   * const reachable = grid.within(unit, unit.moves, { includeCenter: false });
   * ```
   */
  public within(
    center: PointPrimitive,
    radius: number,
    options: WithinOptions = {},
  ): Cell<TData>[] {
    const metric = options.metric ?? 'manhattan';
    const includeCenter = options.includeCenter ?? true;
    const wrap = options.wrap ?? false;
    const cx = Math.round(center.x);
    const cy = Math.round(center.y);
    const extent = Math.floor(radius);

    // A Set dedupes the repeated cells that wrapping can produce on small grids.
    const result = new Set<Cell<TData>>();

    for (let dy = -extent; dy <= extent; dy++) {
      for (let dx = -extent; dx <= extent; dx++) {
        if (dx === 0 && dy === 0 && !includeCenter) {
          continue;
        }

        if (Grid._metricDistance(metric, dx, dy) > radius) {
          continue;
        }

        const cell = wrap
          ? this.wrap(cx + dx, cy + dy)
          : this.cellAt(cx + dx, cy + dy);

        if (cell !== null) {
          result.add(cell);
        }
      }
    }

    return [...result];
  }

  // Distance from a centre to a [dx, dy] offset under the requested metric.
  private static _metricDistance(
    metric: GridMetric,
    dx: number,
    dy: number,
  ): number {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    if (metric === 'chebyshev') {
      return Math.max(ax, ay);
    }

    if (metric === 'euclidean') {
      return Math.hypot(ax, ay);
    }

    return ax + ay;
  }

  /**
   * Finds the cheapest path between two coordinates using A*. Delegates to the
   * grid {@link findPath} helper.
   *
   * Walkability and movement cost default to each cell's {@link Cell.passable}
   * and {@link Cell.cost}; override them per call via
   * {@link PathfindingOptions.isPassable} / {@link PathfindingOptions.cost}
   * without touching the grid. Connectivity follows
   * {@link PathfindingOptions.diagonal} (4-connected by default), and diagonal
   * steps cost `√2` times the destination cell's cost.
   *
   * The `start` is always a valid origin even if impassable; the `end` must be
   * passable.
   *
   * @param start The starting coordinate (a {@link Cell} works, being a
   * {@link PointPrimitive}).
   * @param end The target coordinate.
   * @param options Connectivity, walkability, cost, and heuristic overrides.
   * @returns The ordered cells from `start` to `end` inclusive, or `null` if
   * either endpoint is out of bounds, the `end` is impassable, or no route
   * exists.
   *
   * @example
   * ```typescript
   * // Treat a separate boolean mask as the walkability source.
   * const path = grid.findPath(start, goal, {
   *   diagonal: true,
   *   isPassable: (cell) => mask.cellAt(cell.x, cell.y)?.data === true,
   * });
   * ```
   */
  public findPath(
    start: PointPrimitive,
    end: PointPrimitive,
    options?: PathfindingOptions<TData>,
  ): Cell<TData>[] | null {
    return findPath(this, start, end, options);
  }

  /**
   * Returns a string representation of this grid (its dimensions).
   */
  public toString(): string {
    return `Grid(${this.width} x ${this.height})`;
  }
}
