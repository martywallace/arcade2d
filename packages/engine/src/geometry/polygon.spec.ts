import { Polygon, Rectangle } from './polygon';

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

describe('Rectangle', () => {
  const rect = new Rectangle(30, 40);

  test('it exposes its dimensions and has no position', () => {
    expect(rect.width).toBe(30);
    expect(rect.height).toBe(40);
    expect('x' in rect).toBe(false);
    expect('y' in rect).toBe(false);
  });

  describe('edges', () => {
    test('left/top anchor at the local origin; right/bottom at the extents', () => {
      expect(rect.left).toBe(0);
      expect(rect.right).toBe(30);
      expect(rect.top).toBe(0);
      expect(rect.bottom).toBe(40);
    });
  });

  describe('corners', () => {
    test('they wind clockwise from the local top-left in screen space', () => {
      expect(rect.topLeft).toEqual({ x: 0, y: 0 });
      expect(rect.topRight).toEqual({ x: 30, y: 0 });
      expect(rect.bottomRight).toEqual({ x: 30, y: 40 });
      expect(rect.bottomLeft).toEqual({ x: 0, y: 40 });
    });
  });

  describe('inherited measurements', () => {
    test('area is width × height', () => {
      expect(rect.getArea()).toBeCloseTo(1200, 10);
    });

    test('perimeter is 2 × (width + height)', () => {
      expect(rect.getPerimeter()).toBeCloseTo(140, 10);
    });

    test('center and centroid coincide at the middle', () => {
      expect(rect.getCenter()).toEqual({ x: 15, y: 20 });
      expect(rect.getCentroid().x).toBeCloseTo(15, 10);
      expect(rect.getCentroid().y).toBeCloseTo(20, 10);
    });

    test('getBounds spans the local origin to the extents', () => {
      const bounds = rect.getBounds();

      expect(bounds.min).toEqual({ x: 0, y: 0 });
      expect(bounds.max).toEqual({ x: 30, y: 40 });
    });

    test('getBoundingBox returns an equivalent size', () => {
      expect(rect.getBoundingBox()).toMatchObject({ width: 30, height: 40 });
    });
  });

  describe('containsPoint', () => {
    test('interior and edge points are contained', () => {
      expect(rect.containsPoint({ x: 15, y: 20 })).toBe(true);
      expect(rect.containsPoint({ x: 0, y: 0 })).toBe(true);
      expect(rect.containsPoint({ x: 30, y: 40 })).toBe(true);
    });

    test('exterior points are not contained', () => {
      expect(rect.containsPoint({ x: -1, y: 5 })).toBe(false);
      expect(rect.containsPoint({ x: 31, y: 20 })).toBe(false);
    });
  });

  describe('intersects', () => {
    const unit = new Rectangle(10, 10);

    test('overlapping rectangles intersect', () => {
      expect(unit.intersects(new Rectangle(10, 10), { x: 5, y: 5 })).toBe(true);
    });

    test('edge-touching rectangles intersect', () => {
      expect(unit.intersects(new Rectangle(10, 10), { x: 10, y: 0 })).toBe(
        true,
      );
    });

    test('separated rectangles do not intersect', () => {
      expect(unit.intersects(new Rectangle(5, 5), { x: 20, y: 20 })).toBe(
        false,
      );
    });
  });
});
