import { Point } from './point';

describe('Point', () => {
  test('it will allow reading and writing x and y values', () => {
    const point = new Point(10, 15);

    expect(point.x).toBe(10);
    expect(point.y).toBe(15);

    point.x = 20;
    point.y = 25;

    expect(point.x).toBe(20);
    expect(point.y).toBe(25);
  });

  test('it defaults to 0,0', () => {
    const point = new Point();

    expect(point.x).toBe(0);
    expect(point.y).toBe(0);
  });

  describe('non-finite handling', () => {
    test('the constructor replaces non-finite input with 0', () => {
      expect(new Point(parseFloat('nope'), parseFloat('nope'))).toMatchObject({
        x: 0,
        y: 0,
      });
      expect(new Point(Infinity, -Infinity)).toMatchObject({ x: 0, y: 0 });
    });

    test('the setters preserve the current value on non-finite input', () => {
      const point = new Point(17, 42);

      point.x = parseFloat('nope');
      point.y = Infinity;

      expect(point.x).toBe(17);
      expect(point.y).toBe(42);

      point.y = -Infinity;

      expect(point.y).toBe(42);
    });
  });

  describe('static factories', () => {
    test('zero/up/down/left/right produce the expected points', () => {
      expect(Point.zero()).toMatchObject({ x: 0, y: 0 });
      expect(Point.up()).toMatchObject({ x: 0, y: -1 });
      expect(Point.down()).toMatchObject({ x: 0, y: 1 });
      expect(Point.left()).toMatchObject({ x: -1, y: 0 });
      expect(Point.right()).toMatchObject({ x: 1, y: 0 });
    });

    test('angular produces a unit vector at the given angle', () => {
      expect(Point.angular(0)).toMatchObject({ x: 1, y: 0 });

      const quarter = Point.angular(Math.PI / 2);

      expect(quarter.x).toBeCloseTo(0, 10);
      expect(quarter.y).toBeCloseTo(1, 10);
    });

    test('from accepts a primitive or an [x, y] tuple', () => {
      expect(Point.from({ x: 3, y: 4 })).toMatchObject({ x: 3, y: 4 });
      expect(Point.from([5, 6])).toMatchObject({ x: 5, y: 6 });
    });
  });

  describe('clone', () => {
    test('it produces an independent copy', () => {
      const point = new Point(10, 15);
      const clone = point.clone();

      clone.x = 99;

      expect(clone).not.toBe(point);
      expect(point.x).toBe(10);
    });
  });

  describe('snap', () => {
    test('it snaps to the nearest integer grid by default', () => {
      expect(new Point(1.4, 1.6).snap()).toMatchObject({ x: 1, y: 2 });
    });

    test('it snaps to a custom grid spacing', () => {
      expect(new Point(12, 27).snap(10, 25)).toMatchObject({ x: 10, y: 25 });
    });

    test('a spacing of 0 collapses that axis to 0', () => {
      expect(new Point(12, 27).snap(0, 0)).toMatchObject({ x: 0, y: 0 });
    });

    test('it handles negative coordinates', () => {
      expect(new Point(-12, -7).snap(10, 10)).toMatchObject({ x: -10, y: -10 });
    });

    test('it returns itself for chaining', () => {
      const point = new Point(1, 1);

      expect(point.snap()).toBe(point);
    });
  });

  describe('clone conversions', () => {
    test('cloneToPrimitive produces a plain object', () => {
      const primitive = new Point(3, 4).cloneToPrimitive();

      expect(primitive).toEqual({ x: 3, y: 4 });
      expect(primitive).not.toBeInstanceOf(Point);
    });

    test('cloneToImmutablePrimitive produces a frozen object', () => {
      const primitive = new Point(3, 4).cloneToImmutablePrimitive();

      expect(primitive).toEqual({ x: 3, y: 4 });
      expect(Object.isFrozen(primitive)).toBe(true);
    });

    test('cloneToTuple produces an [x, y] tuple', () => {
      expect(new Point(3, 4).cloneToTuple()).toEqual([3, 4]);
    });

    test('cloneToNormalized produces a unit vector without mutating', () => {
      const point = new Point(3, 4);
      const normalized = point.cloneToNormalized();

      expect(normalized).not.toBe(point);
      expect(normalized.x).toBeCloseTo(0.6, 10);
      expect(normalized.y).toBeCloseTo(0.8, 10);
      expect(normalized.length).toBeCloseTo(1, 10);
      expect(point).toMatchObject({ x: 3, y: 4 });
    });

    test('cloneToNormalized of a zero-length point is 0,0', () => {
      expect(new Point(0, 0).cloneToNormalized()).toMatchObject({ x: 0, y: 0 });
    });
  });

  describe('set / copyFrom', () => {
    test('set updates both coordinates and chains', () => {
      const point = new Point(1, 2);

      expect(point.set(8, 9)).toBe(point);
      expect(point).toMatchObject({ x: 8, y: 9 });
    });

    test('copyFrom copies coordinates from another point and chains', () => {
      const point = new Point(1, 2);

      expect(point.copyFrom({ x: 5, y: 6 })).toBe(point);
      expect(point).toMatchObject({ x: 5, y: 6 });
    });
  });

  describe('add', () => {
    test('it adds loose x and y values', () => {
      expect(new Point(1, 2).add(3, 4)).toMatchObject({ x: 4, y: 6 });
    });

    test('it adds another point', () => {
      expect(new Point(1, 2).add({ x: 3, y: 4 })).toMatchObject({ x: 4, y: 6 });
    });

    test('it returns itself for chaining', () => {
      const point = new Point(0, 0);

      expect(point.add(1, 1)).toBe(point);
    });
  });

  describe('subtract', () => {
    test('it subtracts loose x and y values', () => {
      expect(new Point(5, 5).subtract(2, 1)).toMatchObject({ x: 3, y: 4 });
    });

    test('it subtracts another point', () => {
      expect(new Point(5, 5).subtract({ x: 2, y: 1 })).toMatchObject({
        x: 3,
        y: 4,
      });
    });
  });

  describe('scale', () => {
    test('a single argument scales both axes uniformly', () => {
      expect(new Point(2, 3).scale(2)).toMatchObject({ x: 4, y: 6 });
    });

    test('it scales each axis independently', () => {
      expect(new Point(2, 3).scale(2, 3)).toMatchObject({ x: 4, y: 9 });
    });
  });

  describe('negate', () => {
    test('it flips the sign of both coordinates', () => {
      expect(new Point(2, -3).negate()).toMatchObject({ x: -2, y: 3 });
    });
  });

  describe('normalize', () => {
    test('it normalizes in place to a unit vector', () => {
      const point = new Point(3, 4);

      expect(point.normalize()).toBe(point);
      expect(point.x).toBeCloseTo(0.6, 10);
      expect(point.y).toBeCloseTo(0.8, 10);
      expect(point.length).toBeCloseTo(1, 10);
    });

    test('a zero-length point is left at 0,0', () => {
      expect(new Point(0, 0).normalize()).toMatchObject({ x: 0, y: 0 });
    });
  });

  describe('rotate', () => {
    test('it rotates around the origin by default', () => {
      const point = new Point(1, 0).rotate(Math.PI / 2);

      expect(point.x).toBeCloseTo(0, 10);
      expect(point.y).toBeCloseTo(1, 10);
    });

    test('it rotates around a custom pivot', () => {
      const point = new Point(2, 0).rotate(Math.PI, { x: 1, y: 0 });

      expect(point.x).toBeCloseTo(0, 10);
      expect(point.y).toBeCloseTo(0, 10);
    });
  });

  describe('lerp', () => {
    test('t=0 leaves the point unchanged', () => {
      expect(new Point(0, 0).lerp({ x: 10, y: 10 }, 0)).toMatchObject({
        x: 0,
        y: 0,
      });
    });

    test('t=1 moves the point onto the target', () => {
      expect(new Point(0, 0).lerp({ x: 10, y: 10 }, 1)).toMatchObject({
        x: 10,
        y: 10,
      });
    });

    test('t=0.5 moves the point halfway', () => {
      expect(new Point(0, 0).lerp({ x: 10, y: 20 }, 0.5)).toMatchObject({
        x: 5,
        y: 10,
      });
    });

    test('values outside 0..1 extrapolate', () => {
      expect(new Point(0, 0).lerp({ x: 10, y: 0 }, 2)).toMatchObject({
        x: 20,
        y: 0,
      });
    });
  });

  describe('moveTowards', () => {
    test('it moves toward the target by the given distance', () => {
      expect(new Point(0, 0).moveTowards({ x: 10, y: 0 }, 4)).toMatchObject({
        x: 4,
        y: 0,
      });
    });

    test('it does not overshoot the target', () => {
      expect(new Point(0, 0).moveTowards({ x: 10, y: 0 }, 100)).toMatchObject({
        x: 10,
        y: 0,
      });
    });

    test('it is a no-op when already at the target', () => {
      expect(new Point(5, 5).moveTowards({ x: 5, y: 5 }, 3)).toMatchObject({
        x: 5,
        y: 5,
      });
    });
  });

  describe('forward', () => {
    test('it moves along the angle measured from the origin', () => {
      expect(new Point(1, 0).forward(5)).toMatchObject({ x: 6, y: 0 });

      const point = new Point(0, 2).forward(3);

      expect(point.x).toBeCloseTo(0, 10);
      expect(point.y).toBeCloseTo(5, 10);
    });
  });

  describe('moveInDirection', () => {
    test('it moves in the given direction by the given distance', () => {
      const point = new Point(0, 0).moveInDirection(0, 10);

      expect(point.x).toBeCloseTo(10, 10);
      expect(point.y).toBeCloseTo(0, 10);
    });
  });

  describe('equals', () => {
    test('the default precision of 1 is a loose per-axis check', () => {
      const point = new Point(0, 0);

      expect(point.equals({ x: 1, y: 1 })).toBe(true);
      expect(point.equals({ x: 1, y: 1.0001 })).toBe(false);
    });

    test('precision 0 is an exact comparison', () => {
      const point = new Point(0, 0);

      expect(point.equals({ x: 0, y: 0 }, 0)).toBe(true);
      expect(point.equals({ x: 0.0001, y: 0 }, 0)).toBe(false);
    });
  });

  describe('length', () => {
    test('it will calculate the length', () => {
      const point = new Point(5, 8);

      expect(point.length).toBeCloseTo(9.43398, 5);
    });

    test('the length of a zero point is 0', () => {
      expect(new Point(0, 0).length).toBe(0);
    });
  });

  describe('lengthSquared', () => {
    test('it will calculate the squared length', () => {
      expect(new Point(3, 4).lengthSquared).toBe(25);
    });
  });

  describe('angle', () => {
    test('it will calculate the angle', () => {
      const point = new Point(12, -6.5);

      expect(point.angle).toBeCloseTo(-0.49642, 5);
    });

    test('the angle of a zero point is 0', () => {
      expect(new Point(0, 0).angle).toBe(0);
    });
  });

  describe('distanceTo', () => {
    test('it will calculate the distance to another point', () => {
      const point = new Point(0, 0);

      expect(point.distanceTo({ x: 10, y: 0 })).toBe(10);
      expect(point.distanceTo({ x: -5, y: 0 })).toBe(5);
    });
  });

  describe('distanceSquaredTo', () => {
    test('it will calculate the squared distance to another point', () => {
      expect(new Point(0, 0).distanceSquaredTo({ x: 3, y: 4 })).toBe(25);
    });
  });

  describe('angleTo', () => {
    test('it will calculate the angle to another point', () => {
      const point = new Point(0, 0);

      expect(point.angleTo({ x: 10, y: 0 })).toBe(0);
      expect(point.angleTo({ x: 0, y: 10 })).toBe(Math.PI / 2);
      expect(point.angleTo({ x: -10, y: 0 })).toBe(Math.PI);
      expect(point.angleTo({ x: 0, y: -10 })).toBe(-Math.PI / 2);
    });
  });

  describe('dot', () => {
    test('perpendicular vectors have a dot product of 0', () => {
      expect(new Point(1, 0).dot({ x: 0, y: 1 })).toBe(0);
    });

    test('it calculates the dot product', () => {
      expect(new Point(2, 3).dot({ x: 4, y: 5 })).toBe(23);
    });
  });

  describe('cross', () => {
    test('it calculates the 2D cross product with a sign for winding', () => {
      expect(new Point(1, 0).cross({ x: 0, y: 1 })).toBe(1);
      expect(new Point(0, 1).cross({ x: 1, y: 0 })).toBe(-1);
    });
  });

  describe('toString', () => {
    test('it produces a fixed-precision representation', () => {
      expect(new Point(1, 2).toString()).toBe('Point(1.00, 2.00)');
      expect(new Point(1.005, -3.1).toString()).toBe('Point(1.00, -3.10)');
    });
  });

  test('mutating methods chain together', () => {
    const point = new Point(0, 0).add(10, 10).subtract(2, 2).scale(2).negate();

    expect(point).toMatchObject({ x: -16, y: -16 });
  });
});
