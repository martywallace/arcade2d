import { Application, Container, Graphics as PixiGraphics } from 'pixi.js';
import { Circle } from '../geometry';
import { World } from '../world';
import { CircleGraphics } from './circle-graphics';
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
