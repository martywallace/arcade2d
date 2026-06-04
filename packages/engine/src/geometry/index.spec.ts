import { Circle, Polygon, Rectangle, SHAPE_CONSTRUCTORS } from './index';

describe('geometry barrel', () => {
  test('SHAPE_CONSTRUCTORS lists the shape classes base-before-subclass', () => {
    // Order is load-bearing: Rectangle extends Polygon, so Polygon must
    // initialise first. See the comment on SHAPE_CONSTRUCTORS for why this
    // tuple exists (it forces eager, ordered module initialisation past the
    // shape import cycle so a bundled `new Rectangle()` doesn't hit an
    // uninitialised binding).
    expect(SHAPE_CONSTRUCTORS).toEqual([Polygon, Rectangle, Circle]);
  });

  test('every listed shape constructor is a usable class', () => {
    for (const Ctor of SHAPE_CONSTRUCTORS) {
      expect(typeof Ctor).toBe('function');
    }

    // The regression this guards: constructing each shape must not throw on a
    // freshly-loaded module graph.
    expect(() => new Rectangle(2, 3)).not.toThrow();
    expect(() => new Circle(1)).not.toThrow();
    expect(() => new Polygon([])).not.toThrow();
  });
});
