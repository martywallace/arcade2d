import { Application, Container, Graphics as PixiGraphics } from 'pixi.js';
import { Point, Polygon } from '../geometry';
import { World } from '../world';
import { PolygonGraphics } from './polygon-graphics';
import { Scene } from './scene';

function createFakeApp(): Application {
  return {
    stage: new Container(),
    screen: { width: 800, height: 600 },
    renderer: {
      events: { pointer: { global: { x: 0, y: 0 } } },
    },
  } as unknown as Application;
}

function createWorldWithScene() {
  const app = createFakeApp();
  const world = new World({
    components: (world) => ({
      scene: () => new Scene(world, app),
    }),
  });

  return { world, scene: world.getComponentByType(Scene) };
}

describe('PolygonGraphics', () => {
  test('stores the source polygon for inspection', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const polygon = new Polygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    const graphics = new PolygonGraphics(object, polygon);

    expect(graphics.polygon).toBe(polygon);
  });

  test('raw returns the underlying Pixi Graphics instance', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const polygon = new Polygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]);
    const graphics = new PolygonGraphics(object, polygon);

    expect(graphics.raw).toBeInstanceOf(PixiGraphics);
  });

  test('does not record draw instructions for a degenerate polygon', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const empty = new PolygonGraphics(object, new Polygon([]));
    const twoPoint = new PolygonGraphics(
      object,
      new Polygon([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    );

    expect(empty.raw.context.instructions).toHaveLength(0);
    expect(twoPoint.raw.context.instructions).toHaveLength(0);
  });

  describe('asRectangle', () => {
    test('produces a rectangle polygon centered on the local origin', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty();
      const graphics = PolygonGraphics.asRectangle(object, 20, 10);

      expect(graphics.polygon.points).toEqual([
        { x: -10, y: -5 },
        { x: 10, y: -5 },
        { x: 10, y: 5 },
        { x: -10, y: 5 },
      ]);
    });
  });

  describe('asLine', () => {
    test('produces a thin rectangle polygon centered on the segment', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty();
      // Horizontal segment of length 10 with thickness 2 — perpendicular
      // offset is (0, 1), so the rectangle's long edges sit at y=±1.
      const graphics = PolygonGraphics.asLine(
        object,
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        2,
      );

      expect(graphics.polygon.points).toEqual([
        { x: 0, y: 1 },
        { x: 10, y: 1 },
        { x: 10, y: -1 },
        { x: 0, y: -1 },
      ]);
    });

    test('produces an empty polygon when from and to coincide', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty();
      const graphics = PolygonGraphics.asLine(
        object,
        { x: 5, y: 5 },
        { x: 5, y: 5 },
        4,
      );

      expect(graphics.polygon.points).toEqual([]);
      expect(graphics.raw.context.instructions).toHaveLength(0);
    });
  });

  describe('containsWorldPoint', () => {
    test('respects the host position', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty(new Point(100, 100));
      const graphics = PolygonGraphics.asRectangle(object, 20, 20);

      // World point exactly on the host position lies inside a centered
      // rectangle, even though the local-space test would put it on (0, 0).
      expect(graphics.containsWorldPoint({ x: 100, y: 100 })).toBe(true);
      expect(graphics.containsWorldPoint({ x: 95, y: 105 })).toBe(true);
      expect(graphics.containsWorldPoint({ x: 0, y: 0 })).toBe(false);
    });

    test('respects host rotation', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty(new Point(0, 0));
      object.rotation = Math.PI / 4; // 45°
      // A 10x4 rectangle (long axis on local x). After 45° rotation it now
      // extends diagonally in world space.
      const graphics = PolygonGraphics.asRectangle(object, 10, 4);

      // Point along the rotated long axis (diagonal in world space).
      expect(graphics.containsWorldPoint({ x: 3, y: 3 })).toBe(true);
      // Point along the original (unrotated) +x axis no longer hits — the
      // long edge has rotated off it.
      expect(graphics.containsWorldPoint({ x: 5, y: 0 })).toBe(false);
    });

    test('respects host scale', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty(new Point(0, 0));
      object.scale.set(2, 2);
      const graphics = PolygonGraphics.asRectangle(object, 10, 10);

      // Native rectangle extends to ±5 locally → ±10 in world space.
      expect(graphics.containsWorldPoint({ x: 9, y: 9 })).toBe(true);
      expect(graphics.containsWorldPoint({ x: 11, y: 0 })).toBe(false);
    });

    test('returns false for points outside the polygon', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty(new Point(50, 50));
      const graphics = PolygonGraphics.asRectangle(object, 8, 8);

      expect(graphics.containsWorldPoint({ x: 100, y: 100 })).toBe(false);
    });
  });

  test('parents the display object to the scene on add and detaches on destroy', () => {
    const { world, scene } = createWorldWithScene();
    const object = world.createEmpty();
    const graphics = PolygonGraphics.asRectangle(object, 8, 8);

    object.addComponent('graphics', graphics);
    expect(scene.raw.children).toContain(graphics.raw);

    object.destroy();
    world.update();
    expect(scene.raw.children).not.toContain(graphics.raw);
  });
});
