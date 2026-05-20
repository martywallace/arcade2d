import { Application, Container } from 'pixi.js';
import { World } from '../world';
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

  return { world, scene: world.getComponentByType(Scene), app };
}

describe('Scene', () => {
  test('raw returns the wrapped Pixi Container', () => {
    const { scene } = createWorldWithScene();

    expect(scene.raw).toBeInstanceOf(Container);
  });

  test('mounts its container under the application stage on add', () => {
    const { scene, app } = createWorldWithScene();

    expect(app.stage.children).toContain(scene.raw);
  });

  test('addChild and removeChild proxy to the wrapped container', () => {
    const { scene } = createWorldWithScene();
    const child = new Container();

    scene.addChild(child);
    expect(scene.raw.children).toContain(child);

    scene.removeChild(child);
    expect(scene.raw.children).not.toContain(child);
  });

  test('reports the pointer position from the application renderer', () => {
    const app = createFakeApp();
    (app.renderer.events.pointer.global as { x: number; y: number }).x = 123;
    (app.renderer.events.pointer.global as { x: number; y: number }).y = 456;

    const world = new World({
      components: (world) => ({ scene: () => new Scene(world, app) }),
    });
    const scene = world.getComponentByType(Scene);

    const position = scene.getMousePosition();

    expect(position.x).toBe(123);
    expect(position.y).toBe(456);
  });

  test('detaches its container from the stage on destroy', () => {
    const { scene, app, world } = createWorldWithScene();

    world.removeComponent('scene');

    expect(app.stage.children).not.toContain(scene.raw);
  });
});
