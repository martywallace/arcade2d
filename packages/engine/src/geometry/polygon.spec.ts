import { Polygon } from './polygon';

describe('Polygon', () => {
  // A 3-4-5 right triangle in local space: (0,0), (4,0), (0,3).
  const triangle = new Polygon([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ]);

  describe('getBounds', () => {
    test('it returns the frozen local min/max corners', () => {
      const bounds = triangle.getBounds();

      expect(bounds.min).toEqual({ x: 0, y: 0 });
      expect(bounds.max).toEqual({ x: 4, y: 3 });
      expect(Object.isFrozen(bounds.min)).toBe(true);
      expect(Object.isFrozen(bounds.max)).toBe(true);
    });

    test('an empty polygon yields zero extents at the origin', () => {
      const bounds = new Polygon([]).getBounds();

      expect(bounds.min).toEqual({ x: 0, y: 0 });
      expect(bounds.max).toEqual({ x: 0, y: 0 });
    });
  });

  describe('getBoundingBox', () => {
    test('it returns the extents as a pure rectangle size', () => {
      expect(triangle.getBoundingBox()).toMatchObject({ width: 4, height: 3 });
    });

    test('an empty polygon yields a zero-sized rectangle', () => {
      expect(new Polygon([]).getBoundingBox()).toMatchObject({
        width: 0,
        height: 0,
      });
    });
  });

  describe('getCenter', () => {
    test('it returns the (frozen) bounding-box center', () => {
      const center = triangle.getCenter();

      expect(center).toEqual({ x: 2, y: 1.5 });
      expect(Object.isFrozen(center)).toBe(true);
    });
  });

  describe('getCentroid', () => {
    test('it returns the area centroid', () => {
      const centroid = triangle.getCentroid();

      expect(centroid.x).toBeCloseTo(4 / 3, 10);
      expect(centroid.y).toBeCloseTo(1, 10);
      expect(Object.isFrozen(centroid)).toBe(true);
    });

    test('it falls back to the bounding-box center for < 3 vertices', () => {
      const line = new Polygon([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]);

      expect(line.getCentroid()).toEqual({ x: 1.5, y: 2 });
    });

    test('it falls back to the bounding-box center for a degenerate ring', () => {
      const colinear = new Polygon([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ]);

      expect(colinear.getCentroid()).toEqual({ x: 2, y: 0 });
    });
  });

  describe('getPerimeter', () => {
    test('it sums all edges including the closing edge', () => {
      expect(triangle.getPerimeter()).toBeCloseTo(12, 10);
    });

    test('a polygon with fewer than two vertices has no perimeter', () => {
      expect(new Polygon([{ x: 1, y: 1 }]).getPerimeter()).toBe(0);
    });
  });

  describe('getArea', () => {
    test('it returns the unsigned shoelace area', () => {
      expect(triangle.getArea()).toBeCloseTo(6, 10);
    });

    test('a polygon with fewer than three vertices has no area', () => {
      expect(
        new Polygon([
          { x: 0, y: 0 },
          { x: 3, y: 4 },
        ]).getArea(),
      ).toBe(0);
    });
  });

  describe('containsPoint', () => {
    test('a point inside is contained', () => {
      expect(triangle.containsPoint({ x: 1, y: 1 })).toBe(true);
    });

    test('a point outside is not contained', () => {
      expect(triangle.containsPoint({ x: 3, y: 3 })).toBe(false);
      expect(triangle.containsPoint({ x: -1, y: -1 })).toBe(false);
    });

    test('it is always false for fewer than three vertices', () => {
      const line = new Polygon([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]);

      expect(line.containsPoint({ x: 5, y: 5 })).toBe(false);
    });
  });
});
