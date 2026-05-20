import { Application, Container, Graphics as PixiGraphics } from 'pixi.js';
import { Polygon } from '../geometry';
import { World } from '../world';
import { PolygonGraphics } from './polygon-graphics';
import { Scene } from './scene';

function createFakeApp(): Application {
  return {
    stage: new Container(),
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
