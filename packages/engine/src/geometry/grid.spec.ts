import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Cell } from './cell';
import { Grid } from './grid';

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

describe('Grid', () => {
  describe('construction', () => {
    test('builds width x height cells in row-major order', () => {
      const grid = new Grid(3, 2);

      expect(grid.width).toBe(3);
      expect(grid.height).toBe(2);
      expect(grid.size).toBe(6);
      expect([...grid]).toHaveLength(6);
      expect(grid.cellAt(0, 0)).toBeInstanceOf(Cell);
    });

    test('returns the same cell instance every lookup (stable identity)', () => {
      const grid = new Grid(3, 3);
      expect(grid.cellAt(1, 1)).toBe(grid.cellAt(1, 1));
    });

    test('seeds data from the init factory', () => {
      const grid = new Grid<number>(2, 2, (x, y) => x + y * 2);
      expect(grid.map((cell) => cell.data)).toEqual([0, 1, 2, 3]);
    });

    test.each([
      [0, 5],
      [5, 0],
      [-1, 5],
      [2.5, 5],
      [5, Infinity],
      [NaN, 5],
    ])('throws GRID_INVALID_SIZE for %p x %p', (w, h) => {
      expectEngineError(() => new Grid(w, h), ErrorCode.GRID_INVALID_SIZE);
    });
  });

  describe('cellAt / contains', () => {
    const grid = new Grid(4, 3);

    test('resolves in-bounds coordinates', () => {
      const cell = grid.cellAt(3, 2)!;
      expect(cell.x).toBe(3);
      expect(cell.y).toBe(2);
    });

    test('returns null out of bounds', () => {
      expect(grid.cellAt(-1, 0)).toBeNull();
      expect(grid.cellAt(0, -1)).toBeNull();
      expect(grid.cellAt(4, 0)).toBeNull();
      expect(grid.cellAt(0, 3)).toBeNull();
    });

    test('returns null for non-integer coordinates', () => {
      expect(grid.cellAt(1.5, 1)).toBeNull();
      expect(grid.cellAt(1, 1.5)).toBeNull();
    });

    test('contains mirrors cellAt bounds', () => {
      expect(grid.contains(3, 2)).toBe(true);
      expect(grid.contains(4, 2)).toBe(false);
      expect(grid.contains(1.5, 2)).toBe(false);
    });
  });

  describe('clamp / wrap', () => {
    const grid = new Grid(4, 3);

    test('clamp folds to the nearest edge cell', () => {
      expect(grid.clamp(-5, -5)).toBe(grid.cellAt(0, 0));
      expect(grid.clamp(99, 99)).toBe(grid.cellAt(3, 2));
      expect(grid.clamp(1.4, 1.6)).toBe(grid.cellAt(1, 2));
    });

    test('wrap folds modulo the dimensions, including negatives', () => {
      expect(grid.wrap(4, 3)).toBe(grid.cellAt(0, 0));
      expect(grid.wrap(-1, -1)).toBe(grid.cellAt(3, 2));
      expect(grid.wrap(5, 4)).toBe(grid.cellAt(1, 1));
    });
  });

  describe('row / column', () => {
    const grid = new Grid<string>(3, 2, (x, y) => `${x},${y}`);

    test('row returns left-to-right cells', () => {
      expect(grid.row(1).map((c) => c.data)).toEqual(['0,1', '1,1', '2,1']);
    });

    test('column returns top-to-bottom cells', () => {
      expect(grid.column(2).map((c) => c.data)).toEqual(['2,0', '2,1']);
    });

    test('out-of-bounds index yields an empty array', () => {
      expect(grid.row(9)).toEqual([]);
      expect(grid.row(0.5)).toEqual([]);
      expect(grid.column(-1)).toEqual([]);
      expect(grid.column(2.5)).toEqual([]);
    });
  });

  describe('iteration helpers', () => {
    const grid = new Grid<number>(2, 2, (x, y) => x + y);

    test('forEach visits each cell with its coordinate', () => {
      const seen: string[] = [];
      grid.forEach((cell, x, y) => seen.push(`${x},${y}=${cell.data}`));
      expect(seen).toEqual(['0,0=0', '1,0=1', '0,1=1', '1,1=2']);
    });

    test('map projects cells', () => {
      expect(grid.map((cell) => cell.data)).toEqual([0, 1, 1, 2]);
    });

    test('filter selects matching cells', () => {
      expect(grid.filter((cell) => cell.data === 1)).toHaveLength(2);
    });

    test('find returns the first match or null', () => {
      expect(grid.find((cell) => cell.data === 2)).toBe(grid.cellAt(1, 1));
      expect(grid.find((cell) => cell.data === 99)).toBeNull();
    });
  });

  describe('line', () => {
    const grid = new Grid(10, 10);

    test('traces a diagonal inclusive of both endpoints', () => {
      const cells = grid.line({ x: 0, y: 0 }, { x: 3, y: 3 });
      expect(cells.map((c) => [c.x, c.y])).toEqual([
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
      ]);
    });

    test('traces an axis-aligned run', () => {
      expect(grid.line({ x: 0, y: 2 }, { x: 4, y: 2 })).toHaveLength(5);
    });

    test('a zero-length line is the single cell', () => {
      const cells = grid.line({ x: 5, y: 5 }, { x: 5, y: 5 });
      expect(cells).toEqual([grid.cellAt(5, 5)]);
    });

    test('skips cells that fall outside the grid', () => {
      const cells = grid.line({ x: 8, y: 8 }, { x: 12, y: 8 });
      expect(cells.every((c) => grid.contains(c.x, c.y))).toBe(true);
      expect(cells).toHaveLength(2); // (8,8) and (9,8)
    });
  });

  describe('within', () => {
    const grid = new Grid(7, 7);

    test('manhattan radius is a diamond (default)', () => {
      // A radius-1 diamond around the centre = centre + 4 orthogonal cells.
      expect(grid.within({ x: 3, y: 3 }, 1)).toHaveLength(5);
    });

    test('chebyshev radius is a square', () => {
      expect(
        grid.within({ x: 3, y: 3 }, 1, { metric: 'chebyshev' }),
      ).toHaveLength(9);
    });

    test('euclidean radius is a disc', () => {
      // r=1 disc: centre + 4 orthogonal (diagonals are at sqrt(2) > 1).
      expect(
        grid.within({ x: 3, y: 3 }, 1, { metric: 'euclidean' }),
      ).toHaveLength(5);
    });

    test('includeCenter:false drops the centre', () => {
      expect(
        grid.within({ x: 3, y: 3 }, 1, { includeCenter: false }),
      ).toHaveLength(4);
    });

    test('clips at the grid edge without wrapping', () => {
      expect(grid.within({ x: 0, y: 0 }, 1)).toHaveLength(3);
    });

    test('wrap folds across edges and dedupes', () => {
      const small = new Grid(3, 3);
      const cells = small.within({ x: 0, y: 0 }, 1, { wrap: true });
      // Diamond of 5 distinct cells, even though wrapped offsets overlap.
      expect(cells).toHaveLength(5);
      expect(new Set(cells).size).toBe(cells.length);
    });
  });

  test('toString reports the dimensions', () => {
    expect(new Grid(4, 3).toString()).toBe('Grid(4 x 3)');
  });
});
