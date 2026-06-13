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

    test('the Shape method forms mirror the getters', () => {
      const circle = new Circle(3);

      expect(circle.getArea()).toBe(circle.area);
      expect(circle.getPerimeter()).toBe(circle.circumference);
    });

    test('a negative radius is clamped to zero across every measurement', () => {
      const degenerate = new Circle(-5);

      // The getters clamp like the queries do, so a degenerate circle never
      // reports a negative size — including through the polymorphic
      // Shape.getPerimeter()/getArea() surface collision code relies on.
      expect(degenerate.diameter).toBe(0);
      expect(degenerate.circumference).toBe(0);
      expect(degenerate.area).toBe(0);
      expect(degenerate.getPerimeter()).toBe(0);
      expect(degenerate.getArea()).toBe(0);
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

    test('a negative radius is clamped to zero (no area)', () => {
      const degenerate = new Circle(-5);

      // Only the exact center (on the zero-radius edge) registers; the
      // radius is not squared back into a positive overlap region.
      expect(degenerate.containsPoint({ x: 0, y: 0 })).toBe(true);
      expect(degenerate.containsPoint({ x: 1, y: 0 })).toBe(false);
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

    test('a negative radius contributes no reach to the overlap test', () => {
      // A -5 radius clamps to 0, so this behaves like two radius-0 points and
      // a radius-5 circle: they only intersect within 5 units of each other.
      const degenerate = new Circle(-5);

      expect(degenerate.intersectsCircle(new Circle(5), { x: 5, y: 0 })).toBe(
        true,
      );
      expect(degenerate.intersectsCircle(new Circle(5), { x: 6, y: 0 })).toBe(
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
