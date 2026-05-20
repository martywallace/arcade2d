import { Application, Container } from 'pixi.js';
import { Game } from '../game';
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
  const world = new World(Game.createHeadless(), {
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

  test('camera zoom maps to the container scale', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    world.camera.zoom = 2;
    world.update();

    expect(scene.raw.scale.x).toBe(2);
    expect(scene.raw.scale.y).toBe(2);
  });

  test('camera shake offset adds to the container position, not the pivot', () => {
    const { scene, world } = createWorldWithScene(800, 600);

    // Pin Math.random so the shake produces a deterministic offset of (-5, 0)
    // — see camera.spec.ts for the reasoning.
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      world.camera.shake(10, 1000);
      world.update();

      // Pivot stays on the camera's logical position, not pushed around by
      // the shake.
      expect(scene.raw.pivot.x).toBe(0);
      expect(scene.raw.pivot.y).toBe(0);
      // Container position is canvas centre + shake offset.
      expect(scene.raw.x).toBeCloseTo(400 + -5);
      expect(scene.raw.y).toBeCloseTo(300);
    } finally {
      randomSpy.mockRestore();
    }
  });

  describe('worldToScreen / screenToWorld', () => {
    test('default camera maps world origin to canvas centre', () => {
      const { scene } = createWorldWithScene(800, 600);

      const screen = scene.worldToScreen({ x: 0, y: 0 });

      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    test('camera position shifts the mapping', () => {
      const { scene, world } = createWorldWithScene(800, 600);
      world.camera.position.set(100, 50);

      const screen = scene.worldToScreen({ x: 100, y: 50 });

      expect(screen.x).toBe(400);
      expect(screen.y).toBe(300);
    });

    test('camera zoom scales the mapping', () => {
      const { scene, world } = createWorldWithScene(800, 600);
      world.camera.zoom = 2;

      // A world point 10 units right of the camera lands 20 pixels right of
      // the canvas centre at 2x zoom.
      const screen = scene.worldToScreen({ x: 10, y: 0 });

      expect(screen.x).toBe(420);
      expect(screen.y).toBe(300);
    });

    test('worldToScreen and screenToWorld are inverses', () => {
      const { scene, world } = createWorldWithScene(800, 600);
      world.camera.position.set(33, -17);
      world.camera.rotation = 0.7;
      world.camera.zoom = 1.5;

      const worldPoint = { x: 42, y: 99 };
      const roundTripped = scene.screenToWorld(scene.worldToScreen(worldPoint));

      expect(roundTripped.x).toBeCloseTo(worldPoint.x);
      expect(roundTripped.y).toBeCloseTo(worldPoint.y);
    });

    test('uses logical camera state (ignores shake)', () => {
      const { scene, world } = createWorldWithScene(800, 600);

      // With Math.random pinned to 0.5, shake offset is (-5, 0).
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      try {
        world.camera.shake(10, 1000);
        world.update();

        // Despite a shake being in flight, worldToScreen ignores it — the
        // conversion remains a clean inverse of screenToWorld.
        const screen = scene.worldToScreen({ x: 0, y: 0 });
        expect(screen.x).toBe(400);
        expect(screen.y).toBe(300);
      } finally {
        randomSpy.mockRestore();
      }
    });
  });
});
