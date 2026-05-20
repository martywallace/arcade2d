import { Circle } from './circle';
import { Rectangle } from './rectangle';

describe('Circle', () => {
  test('it defaults to a zero-radius circle', () => {
    expect(new Circle().radius).toBe(0);
  });

  describe('derived measurements', () => {
    test('diameter is twice the radius', () => {
      expect(new Circle(5).diameter).toBe(10);
    });

    test('circumference is 2πr', () => {
      expect(new Circle(2).circumference).toBeCloseTo(4 * Math.PI, 10);
    });

    test('area is πr²', () => {
      expect(new Circle(3).area).toBeCloseTo(Math.PI * 9, 10);
    });
  });

  describe('containsPoint', () => {
    const circle = new Circle(5);

    test('a point inside (relative to center) is contained', () => {
      expect(circle.containsPoint({ x: 0, y: 0 })).toBe(true);
      expect(circle.containsPoint({ x: 3, y: 0 })).toBe(true);
    });

    test('a point exactly on the edge is contained', () => {
      expect(circle.containsPoint({ x: 3, y: 4 })).toBe(true);
      expect(circle.containsPoint({ x: 5, y: 0 })).toBe(true);
    });

    test('a point outside is not contained', () => {
      expect(circle.containsPoint({ x: 6, y: 0 })).toBe(false);
    });
  });

  describe('intersectsCircle', () => {
    const circle = new Circle(5);

    test('overlapping circles intersect', () => {
      expect(circle.intersectsCircle(new Circle(1), { x: 1, y: 0 })).toBe(true);
    });

    test('circles that touch at one point intersect', () => {
      expect(circle.intersectsCircle(new Circle(3), { x: 8, y: 0 })).toBe(true);
    });

    test('separated circles do not intersect', () => {
      expect(circle.intersectsCircle(new Circle(3), { x: 9, y: 0 })).toBe(
        false,
      );
    });
  });

  describe('getBoundingBox', () => {
    test('it returns the tight pure rectangle size', () => {
      const box = new Circle(5).getBoundingBox();

      expect(box).toBeInstanceOf(Rectangle);
      expect(box).toMatchObject({ width: 10, height: 10 });
    });
  });

  describe('clone', () => {
    test('it produces an equal but distinct circle', () => {
      const circle = new Circle(3);
      const clone = circle.clone();

      expect(clone).not.toBe(circle);
      expect(clone.radius).toBe(3);
    });
  });

  describe('toString', () => {
    test('it produces a fixed-precision representation', () => {
      expect(new Circle(5).toString()).toBe('Circle(r=5.00)');
    });
  });
});
