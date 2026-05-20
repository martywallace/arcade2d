import { Application, Container, Graphics as PixiGraphics } from 'pixi.js';
import { Game } from '../game';
import { Circle, Point } from '../geometry';
import { World } from '../world';
import { CircleGraphics } from './circle-graphics';
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
  const world = new World(Game.createHeadless(),{
    components: (world) => ({
      scene: () => new Scene(world, app),
    }),
  });

  return { world, scene: world.getComponentByType(Scene) };
}

describe('CircleGraphics', () => {
  test('stores the source circle for inspection', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const circle = new Circle(12);
    const graphics = new CircleGraphics(object, circle);

    expect(graphics.circle).toBe(circle);
  });

  test('raw returns the underlying Pixi Graphics instance', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const graphics = new CircleGraphics(object, new Circle(8));

    expect(graphics.raw).toBeInstanceOf(PixiGraphics);
  });

  test('does not record draw instructions for a zero-radius circle', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const graphics = new CircleGraphics(object, new Circle(0));

    expect(graphics.raw.context.instructions).toHaveLength(0);
  });

  test('parents the display object to the scene on add and detaches on destroy', () => {
    const { world, scene } = createWorldWithScene();
    const object = world.createEmpty();
    const graphics = new CircleGraphics(object, new Circle(5));

    object.addComponent('graphics', graphics);
    expect(scene.raw.children).toContain(graphics.raw);

    object.destroy();
    world.update();
    expect(scene.raw.children).not.toContain(graphics.raw);
  });

  describe('containsWorldPoint', () => {
    test('respects the host position and radius', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty(new Point(100, 100));
      const graphics = new CircleGraphics(object, new Circle(10));

      expect(graphics.containsWorldPoint({ x: 100, y: 100 })).toBe(true);
      expect(graphics.containsWorldPoint({ x: 109, y: 100 })).toBe(true);
      expect(graphics.containsWorldPoint({ x: 100, y: 111 })).toBe(false);
      expect(graphics.containsWorldPoint({ x: 0, y: 0 })).toBe(false);
    });

    test('respects host scale (treated as the visual extent)', () => {
      const { world } = createWorldWithScene();
      const object = world.createEmpty(new Point(0, 0));
      object.scale.set(2, 2);
      const graphics = new CircleGraphics(object, new Circle(5));

      // Native radius 5 → on screen, the circle reads as radius 10.
      expect(graphics.containsWorldPoint({ x: 9, y: 0 })).toBe(true);
      expect(graphics.containsWorldPoint({ x: 11, y: 0 })).toBe(false);
    });
  });

  test('syncs the host transform on add, before any tick has run', () => {
    // Regression: previously the display sat at Pixi's default (0, 0) until
    // the next onPostUpdate, producing a one-frame flicker at the origin
    // when an object was spawned mid-tick or between bootstrap and the first
    // tick. The fix syncs the transform inside onAdded.
    const { world } = createWorldWithScene();
    const object = world.createEmpty({ x: 250, y: 175 });
    object.rotation = Math.PI;
    object.scale.set(1.5, 2.5);

    const graphics = new CircleGraphics(object, new Circle(5));
    object.addComponent('graphics', graphics);

    expect(graphics.raw.x).toBe(250);
    expect(graphics.raw.y).toBe(175);
    expect(graphics.raw.rotation).toBe(Math.PI);
    expect(graphics.raw.scale.x).toBe(1.5);
    expect(graphics.raw.scale.y).toBe(2.5);
  });

  test('syncs the host transform to the display object during onPostUpdate', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const graphics = new CircleGraphics(object, new Circle(5));
    object.addComponent('graphics', graphics);

    object.position.x = 30;
    object.position.y = 40;
    object.rotation = Math.PI / 2;
    object.scale.x = 2;
    object.scale.y = 3;

    world.update();

    expect(graphics.raw.x).toBe(30);
    expect(graphics.raw.y).toBe(40);
    expect(graphics.raw.rotation).toBe(Math.PI / 2);
    expect(graphics.raw.scale.x).toBe(2);
    expect(graphics.raw.scale.y).toBe(3);
  });
});
