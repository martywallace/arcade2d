import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Cell } from './cell';
import { Grid } from './grid';
import { Point } from './point';

function expectEngineError(fn: () => unknown, code: ErrorCode): void {
  let caught: unknown;

  try {
    fn();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(EngineError);
  expect((caught as EngineError).code).toBe(code);
}

describe('Cell', () => {
  const grid = new Grid<string>(5, 4);

  test('is a Point whose x/y are its grid coordinate', () => {
    const cell = grid.cellAt(2, 3)!;

    expect(cell).toBeInstanceOf(Point);
    expect(cell.x).toBe(2);
    expect(cell.y).toBe(3);
  });

  test('inherits read-only Point queries between cells', () => {
    const a = grid.cellAt(0, 0)!;
    const b = grid.cellAt(3, 4 - 1)!; // (3, 3)

    expect(a.distanceTo(b)).toBeCloseTo(Math.hypot(3, 3));
    expect(a.angleTo(b)).toBeCloseTo(Math.atan2(3, 3));
  });

  test('exposes its owning grid', () => {
    expect(grid.cellAt(1, 1)!.grid).toBe(grid);
  });

  describe('equals', () => {
    test('defaults to an exact comparison, unlike Point.equals', () => {
      const cell = grid.cellAt(2, 2)!;

      // Point.equals defaults to a tolerance of 1, which on discrete grid
      // coordinates would call two adjacent cells equal. Cell overrides the
      // default to 0 (exact), so an adjacent coordinate is not equal.
      expect(cell.equals({ x: 2, y: 2 })).toBe(true);
      expect(cell.equals({ x: 3, y: 2 })).toBe(false);
      expect(cell.equals({ x: 2, y: 3 })).toBe(false);
    });

    test('still honours an explicit precision argument', () => {
      const cell = grid.cellAt(2, 2)!;

      expect(cell.equals({ x: 3, y: 2 }, 1)).toBe(true);
    });
  });

  describe('data and metadata', () => {
    test('cells start empty, passable, with unit cost', () => {
      const cell = grid.cellAt(0, 0)!;

      expect(cell.data).toBeNull();
      expect(cell.empty).toBe(true);
      expect(cell.passable).toBe(true);
      expect(cell.cost).toBe(1);
    });

    test('init factory seeds data and clears empty', () => {
      const seeded = new Grid<string>(2, 2, (x, y) => `${x},${y}`);
      const cell = seeded.cellAt(1, 0)!;

      expect(cell.data).toBe('1,0');
      expect(cell.empty).toBe(false);
    });

    test('data is mutable and round-trips empty', () => {
      const cell = new Grid<string>(1, 1).cellAt(0, 0)!;

      cell.data = 'wall';
      expect(cell.empty).toBe(false);

      cell.data = null;
      expect(cell.empty).toBe(true);
    });
  });

  describe('coordinate immutability', () => {
    test('throws GRID_CELL_IMMUTABLE on a direct x write', () => {
      const cell = grid.cellAt(2, 2)!;
      expectEngineError(() => {
        cell.x = 9;
      }, ErrorCode.GRID_CELL_IMMUTABLE);
    });

    test('throws GRID_CELL_IMMUTABLE on a direct y write', () => {
      const cell = grid.cellAt(2, 2)!;
      expectEngineError(() => {
        cell.y = 9;
      }, ErrorCode.GRID_CELL_IMMUTABLE);
    });

    test('throws GRID_CELL_IMMUTABLE via an inherited Point mutator', () => {
      const cell = grid.cellAt(2, 2)!;
      expectEngineError(() => cell.add(1, 0), ErrorCode.GRID_CELL_IMMUTABLE);
    });

    test('clone() yields a detached, mutable plain Point', () => {
      const cell = grid.cellAt(2, 2)!;
      const detached = cell.clone();

      expect(detached).toBeInstanceOf(Point);
      expect(detached).not.toBeInstanceOf(Cell);

      detached.add(1, 0);
      expect(detached.x).toBe(3);
      expect(cell.x).toBe(2); // original untouched
    });
  });

  describe('directional navigation', () => {
    const c = grid.cellAt(2, 2)!;

    test('left/right/up/down resolve adjacent cells (screen-space up is -y)', () => {
      expect(c.left()).toBe(grid.cellAt(1, 2));
      expect(c.right()).toBe(grid.cellAt(3, 2));
      expect(c.up()).toBe(grid.cellAt(2, 1));
      expect(c.down()).toBe(grid.cellAt(2, 3));
    });

    test('distance argument steps multiple cells', () => {
      expect(c.left(2)).toBe(grid.cellAt(0, 2));
    });

    test('returns null when stepping out of bounds without wrap', () => {
      expect(grid.cellAt(0, 0)!.left()).toBeNull();
      expect(grid.cellAt(0, 0)!.up()).toBeNull();
    });

    test('wraps across edges when asked', () => {
      const corner = grid.cellAt(0, 0)!;

      expect(corner.left(1, true)).toBe(grid.cellAt(4, 0));
      expect(corner.up(1, true)).toBe(grid.cellAt(0, 3));
    });

    test('offset is the general primitive', () => {
      expect(c.offset(1, -1)).toBe(grid.cellAt(3, 1));
      expect(c.offset(99, 0)).toBeNull();
    });
  });

  describe('neighbors', () => {
    test('orthogonal by default (4-connected interior)', () => {
      const neighbors = grid.cellAt(2, 2)!.neighbors();

      expect(neighbors).toHaveLength(4);
      expect(neighbors).toEqual(
        expect.arrayContaining([
          grid.cellAt(2, 1)!,
          grid.cellAt(3, 2)!,
          grid.cellAt(2, 3)!,
          grid.cellAt(1, 2)!,
        ]),
      );
    });

    test('diagonal option adds the corners (8-connected)', () => {
      expect(grid.cellAt(2, 2)!.neighbors({ diagonal: true })).toHaveLength(8);
    });

    test('drops out-of-bounds neighbours at an edge', () => {
      expect(grid.cellAt(0, 0)!.neighbors()).toHaveLength(2);
      expect(grid.cellAt(0, 0)!.neighbors({ diagonal: true })).toHaveLength(3);
    });

    test('wrap keeps the count and folds across edges', () => {
      const wrapped = grid.cellAt(0, 0)!.neighbors({ wrap: true });

      expect(wrapped).toHaveLength(4);
      expect(wrapped).toEqual(expect.arrayContaining([grid.cellAt(4, 0)!]));
    });

    test('never returns the cell itself when wrapping a 1xN grid', () => {
      const strip = new Grid(1, 1);
      expect(strip.cellAt(0, 0)!.neighbors({ wrap: true })).toHaveLength(0);
    });
  });

  describe('grid-native distances', () => {
    const c = grid.cellAt(1, 1)!;

    test('manhattanDistanceTo sums the axis deltas', () => {
      expect(c.manhattanDistanceTo({ x: 4, y: 3 })).toBe(5);
    });

    test('chebyshevDistanceTo takes the larger axis delta', () => {
      expect(c.chebyshevDistanceTo({ x: 4, y: 3 })).toBe(3);
    });
  });

  test('toString reports the coordinate', () => {
    expect(grid.cellAt(2, 3)!.toString()).toBe('Cell(2, 3)');
  });
});
