import { Rectangle } from './rectangle';

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
