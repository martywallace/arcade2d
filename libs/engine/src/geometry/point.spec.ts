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

  test('it will prevent accidental NaN values', () => {
    const dodgyPoint = new Point(parseFloat('nope'), parseFloat('nope'));
    const point = new Point(17, 0);

    point.x = parseFloat('nope');

    expect(dodgyPoint.x).toBe(0);
    expect(dodgyPoint.y).toBe(0);
    expect(point.x).toBe(17);
  });

  describe('length', () => {
    test('it will calculate the length', () => {
      const point = new Point(5, 8);

      expect(point.length).toBeCloseTo(9.43398, 5);
    });
  });

  describe('angle', () => {
    test('it will calculate the angle', () => {
      const point = new Point(12, -6.5);

      expect(point.angle).toBeCloseTo(-0.49642, 5);
    });
  });

  describe('distanceTo', () => {
    test('it will calculate the distance to another point', () => {
      const point = new Point(0, 0);

      expect(point.distanceTo({ x: 10, y: 0 })).toBe(10);
      expect(point.distanceTo({ x: -5, y: 0 })).toBe(5);
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
});
