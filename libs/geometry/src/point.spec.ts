import { Point } from './point';

describe('Point', () => {
  describe('length', () => {
    test('It will calculate the length', () => {
      const point = new Point(5, 8);

      expect(point.length).toBeCloseTo(9.43398, 5);
    });
  });

  describe('angle', () => {
    test('It will calculate the angle', () => {
      const point = new Point(12, -6.5);

      expect(point.angle).toBeCloseTo(-0.49642, 5);
    });
  });

  describe('distanceTo', () => {
    test('It will calculate the distance to another point', () => {
      const point = new Point(0, 0);

      expect(point.distanceTo({ x: 10, y: 0 })).toBe(10);
      expect(point.distanceTo({ x: -5, y: 0 })).toBe(5);
    });
  });

  describe('angleTo', () => {
    test('It will calculate the angle to another point', () => {
      const point = new Point(0, 0);

      expect(point.angleTo({ x: 10, y: 0 })).toBe(0);
      expect(point.angleTo({ x: 0, y: 10 })).toBe(Math.PI / 2);
      expect(point.angleTo({ x: -10, y: 0 })).toBe(Math.PI);
      expect(point.angleTo({ x: 0, y: -10 })).toBe(-Math.PI / 2);
    });
  });
});
