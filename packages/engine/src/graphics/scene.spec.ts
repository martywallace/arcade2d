import { Application, Container } from 'pixi.js';
import { World } from '../world';
import { Scene } from './scene';

function createFakeApp(width = 800, height = 600): Application {
  return {
    stage: new Container(),
    screen: { width, height },
    renderer: {
      events: { pointer: { global: { x: 0, y: 0 } } },
    },
  } as unknown as Application;
}

function createWorldWithScene(width?: number, height?: number) {
  const app = createFakeApp(width, height);
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

  test('detaches its container from the stage on destroy', () => {
    const { scene, app, world } = createWorldWithScene();

    world.removeComponent('scene');

    expect(app.stage.children).not.toContain(scene.raw);
  });

  test('default camera frames world origin at the canvas centre after one tick', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.update();

    expect(scene.raw.pivot.x).toBe(0);
    expect(scene.raw.pivot.y).toBe(0);
    expect(scene.raw.x).toBe(400);
    expect(scene.raw.y).toBe(300);
    expect(scene.raw.rotation).toBe(0);
  });

  test('camera position becomes the container pivot each tick', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.position.set(150, 75);
    world.update();

    expect(scene.raw.pivot.x).toBe(150);
    expect(scene.raw.pivot.y).toBe(75);
    // Container still anchors to the canvas centre — pivot, not container x,
    // is what shifts when the camera moves.
    expect(scene.raw.x).toBe(400);
    expect(scene.raw.y).toBe(300);
  });

  test('camera rotation applies its inverse to the container', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.rotation = Math.PI / 4;
    world.update();

    expect(scene.raw.rotation).toBeCloseTo(-Math.PI / 4);
  });

  test('post-update reframes after each camera mutation', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.position.set(10, 20);
    world.update();
    expect(scene.raw.pivot.x).toBe(10);

    world.camera.position.set(99, 11);
    world.update();
    expect(scene.raw.pivot.x).toBe(99);
    expect(scene.raw.pivot.y).toBe(11);
  });
});
