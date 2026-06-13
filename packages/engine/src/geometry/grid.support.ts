import type { Cell } from './cell';
import { DIAGONAL_OFFSETS, ORTHOGONAL_OFFSETS } from './grid.constants';
import type { Grid } from './grid';
import type { GridHeuristic, PathfindingOptions } from './grid.types';
import type { PointPrimitive } from './point.types';

/**
 * The Manhattan (taxicab) heuristic — `|dx| + |dy|`. Admissible and consistent
 * for 4-connected grids with unit step costs, and the default
 * {@link Grid.findPath} heuristic for orthogonal movement.
 *
 * @param a The first coordinate.
 * @param b The second coordinate.
 * @returns The Manhattan distance between `a` and `b`.
 */
export function manhattan(a: PointPrimitive, b: PointPrimitive): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * The Chebyshev (chessboard) heuristic — `max(|dx|, |dy|)`. Appropriate when a
 * diagonal step costs the same as an orthogonal one.
 *
 * @param a The first coordinate.
 * @param b The second coordinate.
 * @returns The Chebyshev distance between `a` and `b`.
 */
export function chebyshev(a: PointPrimitive, b: PointPrimitive): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The octile heuristic — Chebyshev distance with diagonal steps weighted by
 * `√2`. Admissible and consistent for 8-connected grids where diagonal moves
 * cost `√2`, and the default {@link Grid.findPath} heuristic when diagonal
 * movement is enabled.
 *
 * @param a The first coordinate.
 * @param b The second coordinate.
 * @returns The octile distance between `a` and `b`.
 */
export function octile(a: PointPrimitive, b: PointPrimitive): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);

  return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

/**
 * One entry in the A* open set: the frontier cell, its `f = g + h` priority,
 * and a monotonically increasing insertion sequence used as a stable
 * tie-breaker so equal-priority cells pop in FIFO order (deterministic paths).
 *
 * @internal
 */
interface OpenEntry<TData> {
  cell: Cell<TData>;
  f: number;
  seq: number;
}

/**
 * Sifts the entry at `index` up the binary min-heap until the heap property
 * holds. Lower `f` wins; ties break on the earlier `seq`.
 *
 * @internal
 */
function heapSiftUp<TData>(heap: OpenEntry<TData>[], index: number): void {
  let i = index;

  while (i > 0) {
    const parent = (i - 1) >> 1;
    const a = heap[i]!;
    const b = heap[parent]!;

    if (a.f > b.f || (a.f === b.f && a.seq >= b.seq)) {
      break;
    }

    heap[i] = b;
    heap[parent] = a;
    i = parent;
  }
}

/**
 * Sifts the root down the binary min-heap until the heap property holds, after
 * the root has been replaced by the last element.
 *
 * @internal
 */
function heapSiftDown<TData>(heap: OpenEntry<TData>[]): void {
  const length = heap.length;
  let i = 0;

  for (;;) {
    const left = i * 2 + 1;
    const right = left + 1;
    let smallest = i;

    if (left < length && isBefore(heap[left]!, heap[smallest]!)) {
      smallest = left;
    }

    if (right < length && isBefore(heap[right]!, heap[smallest]!)) {
      smallest = right;
    }

    if (smallest === i) {
      break;
    }

    const tmp = heap[i]!;
    heap[i] = heap[smallest]!;
    heap[smallest] = tmp;
    i = smallest;
  }
}

/**
 * Orders two open-set entries: lower `f` first, ties broken on earlier `seq`.
 *
 * @internal
 */
function isBefore<TData>(a: OpenEntry<TData>, b: OpenEntry<TData>): boolean {
  return a.f < b.f || (a.f === b.f && a.seq < b.seq);
}

/**
 * Walks the `cameFrom` chain back from `end` to the start cell, producing the
 * ordered start-to-end path.
 *
 * @internal
 */
function reconstruct<TData>(
  cameFrom: Map<Cell<TData>, Cell<TData>>,
  end: Cell<TData>,
): Cell<TData>[] {
  const path: Cell<TData>[] = [end];
  let current: Cell<TData> | undefined = end;

  while ((current = cameFrom.get(current)) !== undefined) {
    path.push(current);
  }

  path.reverse();

  return path;
}

/**
 * Finds the cheapest path between two cells of a {@link Grid} using A*.
 *
 * Backs {@link Grid.findPath}; prefer calling that. Walkability and movement
 * cost default to each cell's {@link Cell.passable} / {@link Cell.cost}, both
 * overridable via {@link PathfindingOptions}. The `start` cell is always a
 * valid origin even when impassable; the `end` cell must be passable. Diagonal
 * moves (when enabled) cost `√2` times the destination cell's cost.
 *
 * @param grid The grid to search within.
 * @param start The starting coordinate; resolved via {@link Grid.cellAt}.
 * @param end The target coordinate; resolved via {@link Grid.cellAt}.
 * @param options Connectivity, walkability, cost, and heuristic overrides.
 * @returns The ordered list of cells from `start` to `end` inclusive, or `null`
 * if either endpoint is out of bounds, the `end` is impassable, or no route
 * exists.
 */
export function findPath<TData>(
  grid: Grid<TData>,
  start: PointPrimitive,
  end: PointPrimitive,
  options: PathfindingOptions<TData> = {},
): Cell<TData>[] | null {
  const startCell = grid.cellAt(start.x, start.y);
  const endCell = grid.cellAt(end.x, end.y);

  if (startCell === null || endCell === null) {
    return null;
  }

  if (startCell === endCell) {
    return [startCell];
  }

  const diagonal = options.diagonal ?? false;
  const wrap = options.wrap ?? false;
  const isPassable =
    options.isPassable ?? ((cell: Cell<TData>) => cell.passable);
  const costOf = options.cost ?? ((cell: Cell<TData>) => cell.cost);
  const heuristic: GridHeuristic =
    options.heuristic ?? (diagonal ? octile : manhattan);

  if (!isPassable(endCell)) {
    return null;
  }

  const offsets = diagonal
    ? [...ORTHOGONAL_OFFSETS, ...DIAGONAL_OFFSETS]
    : ORTHOGONAL_OFFSETS;

  const gScore = new Map<Cell<TData>, number>([[startCell, 0]]);
  const cameFrom = new Map<Cell<TData>, Cell<TData>>();
  const closed = new Set<Cell<TData>>();
  const open: OpenEntry<TData>[] = [
    { cell: startCell, f: heuristic(startCell, endCell), seq: 0 },
  ];
  let seq = 1;

  while (open.length > 0) {
    const current = open[0]!.cell;

    // Pop the min: move the last entry to the root and sift it down.
    const last = open.pop()!;
    if (open.length > 0) {
      open[0] = last;
      heapSiftDown(open);
    }

    // Lazy deletion: a cell can sit in the heap more than once after a cheaper
    // route to it is found; ignore the stale duplicates once it is finalised.
    if (closed.has(current)) {
      continue;
    }
    closed.add(current);

    if (current === endCell) {
      return reconstruct(cameFrom, endCell);
    }

    const currentG = gScore.get(current)!;

    for (const [dx, dy] of offsets) {
      const neighbor = current.offset(dx, dy, wrap);

      if (
        neighbor === null ||
        neighbor === current ||
        closed.has(neighbor) ||
        !isPassable(neighbor)
      ) {
        continue;
      }

      const stepCost =
        costOf(neighbor) * (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      const tentativeG = currentG + stepCost;

      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);

        const entry: OpenEntry<TData> = {
          cell: neighbor,
          f: tentativeG + heuristic(neighbor, endCell),
          seq: seq++,
        };
        open.push(entry);
        heapSiftUp(open, open.length - 1);
      }
    }
  }

  return null;
}
