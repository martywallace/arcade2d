import { Circle } from './circle';
import { shapesIntersect } from './intersection.support';
import { Polygon } from './polygon';
import { Rectangle } from './rectangle';
import type { Shape } from './shape.types';

describe('shape intersection matrix', () => {
  describe('circle vs circle', () => {
    const a = new Circle(5);

    test('overlapping circles intersect', () => {
      expect(a.intersects(new Circle(5), { x: 8, y: 0 })).toBe(true);
    });

    test('circles touching at one point intersect', () => {
      expect(a.intersects(new Circle(5), { x: 10, y: 0 })).toBe(true);
    });

    test('separated circles do not intersect', () => {
      expect(a.intersects(new Circle(5), { x: 11, y: 0 })).toBe(false);
    });
  });

  describe('circle vs rectangle', () => {
    const circle = new Circle(5);
    const rect = new Rectangle(10, 10);

    test('intersects when the circle centre is inside the rectangle', () => {
      // offset is the rect's top-left relative to the circle centre; placing
      // it at (-5,-5) centres the rect on the circle.
      expect(circle.intersects(rect, { x: -5, y: -5 })).toBe(true);
    });

    test('intersects when the centre is within the radius of an edge', () => {
      // Centre lands 5px past the rect's right edge — exactly the radius.
      expect(circle.intersects(rect, { x: -15, y: -5 })).toBe(true);
    });

    test('does not intersect when the centre is beyond the radius', () => {
      expect(circle.intersects(rect, { x: -16, y: -5 })).toBe(false);
    });

    test('rectangle-vs-circle agrees with circle-vs-rectangle', () => {
      // Reverse roles: offset is now the circle centre relative to the rect
      // origin. 5px past the right edge -> touching.
      expect(rect.intersects(circle, { x: 15, y: 5 })).toBe(true);
      expect(rect.intersects(circle, { x: 16, y: 5 })).toBe(false);
    });
  });

  describe('polygon vs polygon (SAT)', () => {
    const triangle = new Polygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ]);

    test('overlapping triangles intersect', () => {
      expect(triangle.intersects(triangle, { x: 2, y: 2 })).toBe(true);
    });

    test('separated triangles do not intersect', () => {
      expect(triangle.intersects(triangle, { x: 50, y: 50 })).toBe(false);
    });

    test('rectangles touching at an edge intersect', () => {
      const rect = new Rectangle(10, 10);

      expect(rect.intersects(new Rectangle(10, 10), { x: 10, y: 0 })).toBe(
        true,
      );
      expect(rect.intersects(new Rectangle(10, 10), { x: 11, y: 0 })).toBe(
        false,
      );
    });
  });

  describe('circle vs polygon', () => {
    const circle = new Circle(3);
    const triangle = new Polygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ]);

    test('intersects when near an edge', () => {
      expect(circle.intersects(triangle, { x: 1, y: 1 })).toBe(true);
    });

    test('does not intersect when clearly outside', () => {
      expect(circle.intersects(triangle, { x: 40, y: 40 })).toBe(false);
    });
  });

  describe('degenerate inputs', () => {
    const circle = new Circle(5);

    test('an empty polygon never intersects (either order)', () => {
      const empty = new Polygon([]);

      expect(circle.intersects(empty, { x: 0, y: 0 })).toBe(false);
      expect(empty.intersects(circle, { x: 0, y: 0 })).toBe(false);
      expect(empty.intersects(new Rectangle(4, 4), { x: 0, y: 0 })).toBe(false);
    });

    test('a polygon with a zero-length edge still resolves via its other axes', () => {
      // The duplicated first vertex yields a zero-length edge whose separating
      // axis is skipped; the remaining edges still classify the overlap.
      const degenerate = new Polygon([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]);

      expect(degenerate.intersects(new Rectangle(4, 4), { x: 1, y: 1 })).toBe(
        true,
      );
    });

    test('circle distance handles a polygon with a zero-length edge', () => {
      // Exercises the degenerate-segment path in the point-to-segment
      // distance: the circle centre is outside, so each edge distance is
      // measured, including the zero-length one.
      const degenerate = new Polygon([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);

      expect(circle.intersects(degenerate, { x: 100, y: 100 })).toBe(false);
      expect(circle.intersects(degenerate, { x: -2, y: 0 })).toBe(true);
    });

    test('an unrecognised shape pair returns false', () => {
      // A custom Shape that is neither Circle nor Polygon falls through the
      // dispatch to the conservative default.
      const fake: Shape = {
        getArea: () => 0,
        getPerimeter: () => 0,
        getBoundingBox: () => new Rectangle(0, 0),
        containsPoint: () => false,
        intersects: () => false,
        clone: () => fake,
      };

      expect(shapesIntersect(fake, fake, { x: 0, y: 0 })).toBe(false);
    });
  });
});
