import { Matrix } from './matrix';
import { Point } from './point';

describe('Matrix', () => {
  describe('identity', () => {
    test('leaves a point unchanged when applied', () => {
      const result = Matrix.identity().apply({ x: 7, y: -3 });

      expect(result.x).toBe(7);
      expect(result.y).toBe(-3);
    });

    test('default-constructed matrix is the identity', () => {
      const matrix = new Matrix();

      expect([
        matrix.a,
        matrix.b,
        matrix.c,
        matrix.d,
        matrix.tx,
        matrix.ty,
      ]).toEqual([1, 0, 0, 1, 0, 0]);
    });
  });

  describe('compose', () => {
    test('translation maps the origin to the position', () => {
      const matrix = Matrix.compose({ x: 10, y: 20 }, 0, { x: 1, y: 1 });
      const result = matrix.apply({ x: 0, y: 0 });

      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(20);
    });

    test('applies scale, then rotation, then translation in that order', () => {
      // Local (1, 0) → scale (2, 2) → (2, 0) → rotate 90° (screen-y-down, so
      // into +y) → (0, 2) → translate (10, 20) → (10, 22).
      const matrix = Matrix.compose({ x: 10, y: 20 }, Math.PI / 2, {
        x: 2,
        y: 2,
      });
      const result = matrix.apply({ x: 1, y: 0 });

      expect(result.x).toBeCloseTo(10);
      expect(result.y).toBeCloseTo(22);
    });

    test('scales each axis independently', () => {
      const matrix = Matrix.compose({ x: 0, y: 0 }, 0, { x: 3, y: 5 });
      const result = matrix.apply({ x: 1, y: 1 });

      expect(result.x).toBeCloseTo(3);
      expect(result.y).toBeCloseTo(5);
    });
  });

  describe('append', () => {
    test('post-multiplies so the appended matrix applies first', () => {
      const translate = Matrix.compose({ x: 5, y: 0 }, 0, { x: 1, y: 1 });
      const scale = Matrix.compose({ x: 0, y: 0 }, 0, { x: 2, y: 2 });

      // translate.append(scale): a point is scaled, then translated.
      const result = translate.append(scale).apply({ x: 1, y: 1 });

      expect(result.x).toBeCloseTo(7);
      expect(result.y).toBeCloseTo(2);
    });

    test('mutates and returns this for chaining', () => {
      const matrix = Matrix.identity();
      const returned = matrix.append(
        Matrix.compose({ x: 1, y: 2 }, 0, { x: 1, y: 1 }),
      );

      expect(returned).toBe(matrix);
      expect(matrix.tx).toBeCloseTo(1);
      expect(matrix.ty).toBeCloseTo(2);
    });

    test('composing parent then child world matrices nests the transforms', () => {
      // Parent at (100, 0) rotated 90°; child offset (10, 0) in parent space.
      const parent = Matrix.compose({ x: 100, y: 0 }, Math.PI / 2, {
        x: 1,
        y: 1,
      });
      const child = Matrix.compose({ x: 10, y: 0 }, 0, { x: 1, y: 1 });

      const world = parent.append(child).apply({ x: 0, y: 0 });

      // Child origin: (10, 0) rotated 90° → (0, 10), translated by parent.
      expect(world.x).toBeCloseTo(100);
      expect(world.y).toBeCloseTo(10);
    });
  });

  describe('invert', () => {
    test('undoes the original transform', () => {
      const matrix = Matrix.compose({ x: 10, y: -5 }, 1.234, {
        x: 2.5,
        y: 0.5,
      });
      const point = { x: 7, y: -3 };

      const forward = matrix.apply(point);
      const back = matrix.clone().invert().apply(forward);

      expect(back.x).toBeCloseTo(point.x);
      expect(back.y).toBeCloseTo(point.y);
    });

    test('resets a singular (zero-determinant) matrix to the identity', () => {
      const collapsed = Matrix.compose({ x: 5, y: 5 }, 0, { x: 0, y: 0 });

      collapsed.invert();

      expect([
        collapsed.a,
        collapsed.b,
        collapsed.c,
        collapsed.d,
        collapsed.tx,
        collapsed.ty,
      ]).toEqual([1, 0, 0, 1, 0, 0]);
    });
  });

  describe('apply', () => {
    test('returns a fresh Point and does not mutate the matrix', () => {
      const matrix = Matrix.compose({ x: 1, y: 1 }, 0, { x: 1, y: 1 });
      const result = matrix.apply(new Point(2, 3));

      result.set(0, 0);

      expect(matrix.tx).toBe(1);
      expect(matrix.ty).toBe(1);
    });
  });

  describe('decompose', () => {
    test('round-trips a TRS matrix with non-negative scale', () => {
      const decomposed = Matrix.compose({ x: 12, y: -8 }, 0.7, {
        x: 3,
        y: 2,
      }).decompose();

      expect(decomposed.x).toBeCloseTo(12);
      expect(decomposed.y).toBeCloseTo(-8);
      expect(decomposed.rotation).toBeCloseTo(0.7);
      expect(decomposed.scaleX).toBeCloseTo(3);
      expect(decomposed.scaleY).toBeCloseTo(2);
    });

    test('reports non-negative scales for the identity', () => {
      const decomposed = Matrix.identity().decompose();

      expect(decomposed.scaleX).toBe(1);
      expect(decomposed.scaleY).toBe(1);
      expect(decomposed.rotation).toBe(0);
    });
  });

  describe('clone', () => {
    test('produces an independent copy', () => {
      const matrix = Matrix.compose({ x: 1, y: 2 }, 0.5, { x: 1, y: 1 });
      const copy = matrix.clone();

      copy.append(Matrix.compose({ x: 100, y: 100 }, 0, { x: 1, y: 1 }));

      expect(matrix.tx).toBeCloseTo(1);
      expect(matrix.ty).toBeCloseTo(2);
    });
  });
});
