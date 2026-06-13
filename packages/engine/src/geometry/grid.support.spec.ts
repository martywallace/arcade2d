import { Cell } from './cell';
import { Grid } from './grid';
import { chebyshev, findPath, manhattan, octile } from './grid.support';
import type { PointPrimitive } from './point.types';

function assertContiguous(
  path: Cell<unknown>[] | null,
  start: PointPrimitive,
  end: PointPrimitive,
  grid: Grid<unknown>,
  diagonal = false,
): asserts path is Cell<unknown>[] {
  expect(path).not.toBeNull();
  const cells = path!;

  expect(cells[0]).toBe(grid.cellAt(start.x, start.y));
  expect(cells[cells.length - 1]).toBe(grid.cellAt(end.x, end.y));

  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1]!;
    const b = cells[i]!;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const step = diagonal ? Math.max(dx, dy) : dx + dy;

    expect(step).toBe(1);
  }
}

describe('grid pathfinding heuristics', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 3, y: 1 };

  test('manhattan sums axis deltas', () => {
    expect(manhattan(a, b)).toBe(4);
  });

  test('chebyshev takes the larger axis delta', () => {
    expect(chebyshev(a, b)).toBe(3);
  });

  test('octile weights the diagonal portion by sqrt(2)', () => {
    expect(octile(a, b)).toBeCloseTo(2 + Math.SQRT2);
  });
});

describe('findPath', () => {
  describe('trivial cases', () => {
    const grid = new Grid(5, 5);

    test('finds the shortest straight path, inclusive of endpoints', () => {
      const path = grid.findPath({ x: 0, y: 0 }, { x: 3, y: 0 });
      assertContiguous(path, { x: 0, y: 0 }, { x: 3, y: 0 }, grid);
      expect(path).toHaveLength(4);
    });

    test('start equal to end returns the single cell', () => {
      expect(grid.findPath({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([
        grid.cellAt(2, 2),
      ]);
    });

    test('out-of-bounds start or end returns null', () => {
      expect(grid.findPath({ x: -1, y: 0 }, { x: 2, y: 2 })).toBeNull();
      expect(grid.findPath({ x: 0, y: 0 }, { x: 9, y: 9 })).toBeNull();
    });
  });

  describe('obstacles', () => {
    function walledGrid(): Grid<unknown> {
      // A vertical wall at x = 2 spanning rows 0..3, with a gap at (2, 4).
      const grid = new Grid(5, 5);
      for (let y = 0; y < 4; y++) {
        grid.cellAt(2, y)!.passable = false;
      }
      return grid;
    }

    test('routes around an obstacle', () => {
      const grid = walledGrid();
      const path = grid.findPath({ x: 0, y: 0 }, { x: 4, y: 0 });

      assertContiguous(path, { x: 0, y: 0 }, { x: 4, y: 0 }, grid);
      expect(path.every((cell) => cell.passable)).toBe(true);
      expect(path).toContain(grid.cellAt(2, 4)); // through the gap
    });

    test('returns null when the target is walled off', () => {
      const grid = new Grid(5, 5);
      for (let y = 0; y < 5; y++) {
        grid.cellAt(2, y)!.passable = false; // full wall, no gap
      }
      expect(grid.findPath({ x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
    });

    test('returns null when the end cell itself is impassable', () => {
      const grid = new Grid(5, 5);
      grid.cellAt(4, 0)!.passable = false;
      expect(grid.findPath({ x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
    });

    test('an impassable start is still a valid origin', () => {
      const grid = new Grid(5, 5);
      grid.cellAt(0, 0)!.passable = false;
      const path = grid.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
      assertContiguous(path, { x: 0, y: 0 }, { x: 2, y: 0 }, grid);
    });
  });

  describe('connectivity', () => {
    const grid = new Grid(5, 5);

    test('diagonal movement shortens a corner-to-corner path', () => {
      const orthogonal = grid.findPath({ x: 0, y: 0 }, { x: 3, y: 3 });
      const diagonal = grid.findPath(
        { x: 0, y: 0 },
        { x: 3, y: 3 },
        { diagonal: true },
      );

      expect(orthogonal).toHaveLength(7);
      assertContiguous(diagonal, { x: 0, y: 0 }, { x: 3, y: 3 }, grid, true);
      expect(diagonal).toHaveLength(4);
    });

    test('wrapping finds the shorter route across an edge', () => {
      const strip = new Grid(5, 1);
      const direct = strip.findPath({ x: 0, y: 0 }, { x: 4, y: 0 });
      const wrapped = strip.findPath(
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { wrap: true },
      );

      expect(direct).toHaveLength(5);
      expect(wrapped).toHaveLength(2); // step left across the seam
    });
  });

  describe('cost', () => {
    test('routes around an expensive cell using cell.cost', () => {
      const grid = new Grid(3, 3);
      grid.cellAt(1, 1)!.cost = 100;

      const path = grid.findPath({ x: 0, y: 1 }, { x: 2, y: 1 });
      assertContiguous(path, { x: 0, y: 1 }, { x: 2, y: 1 }, grid);
      expect(path).not.toContain(grid.cellAt(1, 1));
    });

    test('a per-call cost override beats cell.cost', () => {
      const grid = new Grid(3, 3); // every cell cheap by default
      const path = grid.findPath(
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        {
          cost: (cell) => (cell === grid.cellAt(1, 1) ? 100 : 1),
        },
      );
      expect(path).not.toContain(grid.cellAt(1, 1));
    });
  });

  describe('passability overrides', () => {
    test('isPassable override can open a cell the metadata blocks', () => {
      const grid = new Grid(3, 3);
      grid.cellAt(1, 1)!.passable = false; // metadata says wall

      const path = grid.findPath(
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        {
          isPassable: () => true, // ignore metadata
        },
      );
      expect(path).toHaveLength(3); // straight through (1,1)
      expect(path).toContain(grid.cellAt(1, 1));
    });

    test('isPassable override can close a cell the metadata allows', () => {
      const grid = new Grid(3, 3); // all passable by default
      const blocked = grid.cellAt(1, 1)!;

      const path = grid.findPath(
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        {
          isPassable: (cell) => cell !== blocked,
        },
      );
      assertContiguous(path, { x: 0, y: 1 }, { x: 2, y: 1 }, grid);
      expect(path).not.toContain(blocked);
    });

    test('an unreachable end under the override returns null', () => {
      const grid = new Grid(3, 3);
      const end = grid.cellAt(2, 1)!;
      expect(
        grid.findPath(
          { x: 0, y: 1 },
          { x: 2, y: 1 },
          {
            isPassable: (cell) => cell !== end,
          },
        ),
      ).toBeNull();
    });
  });

  test('a custom heuristic still yields a contiguous path', () => {
    const grid = new Grid(5, 5);
    const path = findPath(
      grid,
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      {
        heuristic: () => 0, // degenerates A* to Dijkstra
      },
    );
    assertContiguous(path, { x: 0, y: 0 }, { x: 4, y: 4 }, grid);
  });

  test('an inconsistent heuristic re-opens a frontier cell without corrupting the result', () => {
    // An inconsistent heuristic makes a high-cost route to (1,1) get explored
    // before the cheap one, so (1,1) is pushed twice; the stale duplicate must
    // be skipped when popped (the lazy-deletion guard). The goal (2,2) is
    // walled off so the search drains fully and returns null.
    const grid = new Grid(3, 3);
    grid.cellAt(1, 0)!.cost = 10;
    grid.cellAt(2, 1)!.passable = false;
    grid.cellAt(1, 2)!.passable = false;

    const result = findPath(
      grid,
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      {
        heuristic: (a) => {
          if (a.x === 0 && a.y === 1) return 50;
          if (a.x === 1 && a.y === 1) return 100;
          return 0;
        },
      },
    );

    expect(result).toBeNull();
  });
});
