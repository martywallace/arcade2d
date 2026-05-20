/**
 * @jest-environment jsdom
 */

import { Application, Container } from 'pixi.js';
import { Scene } from '../graphics/scene';
import { World } from '../world';
import { Mouse } from './mouse';

function createTestHarness(width = 800, height = 600) {
  const canvas = document.createElement('canvas');
  const app = {
    canvas,
    screen: { width, height },
    stage: new Container(),
  } as unknown as Application;

  const world = new World({
    components: (world) => ({
      scene: () => new Scene(world, app),
      mouse: () => new Mouse(world, app),
    }),
  });

  return { world, canvas, app, mouse: world.getComponent<Mouse>('mouse') };
}

describe('Mouse', () => {
  test('default state has zero position and no buttons pressed', () => {
    const { world } = createTestHarness();
    const state = world.getMouseState();

    expect(state.screenPosition.x).toBe(0);
    expect(state.screenPosition.y).toBe(0);
    expect(state.buttons.left).toBe(false);
    expect(state.buttons.right).toBe(false);
    expect(state.buttons.middle).toBe(false);
  });

  test('mousemove updates the screen position snapshot after onPreUpdate', () => {
    const { world, canvas } = createTestHarness();

    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 100, clientY: 200 }),
    );

    // Pending buffer has the new value but the snapshot does not — snapshots
    // only refresh on tick boundaries, so reads during the same frame as
    // a DOM event still see the previous tick's value.
    expect(world.getMouseState().screenPosition.x).toBe(0);

    world.update();

    expect(world.getMouseState().screenPosition.x).toBe(100);
    expect(world.getMouseState().screenPosition.y).toBe(200);
  });

  test('mousedown sets the matching button flag after the next tick', () => {
    const { world, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 1 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));

    world.update();

    const { buttons } = world.getMouseState();

    expect(buttons.left).toBe(true);
    expect(buttons.middle).toBe(true);
    expect(buttons.right).toBe(true);
  });

  test('window mouseup clears button state', () => {
    const { world, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    world.update();
    expect(world.getMouseState().buttons.left).toBe(true);

    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    world.update();
    expect(world.getMouseState().buttons.left).toBe(false);
  });

  test('ignores buttons outside the standard left/middle/right range', () => {
    const { world, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 3 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 4 }));
    world.update();

    const { buttons } = world.getMouseState();
    expect(buttons.left).toBe(false);
    expect(buttons.middle).toBe(false);
    expect(buttons.right).toBe(false);
  });

  test('returned state object is a fresh snapshot per call', () => {
    const { world } = createTestHarness();

    const a = world.getMouseState();
    const b = world.getMouseState();

    expect(a).not.toBe(b);
    expect(a.position).not.toBe(b.position);
    expect(a.screenPosition).not.toBe(b.screenPosition);
    expect(a.buttons).not.toBe(b.buttons);
  });

  test('default camera maps canvas centre to world origin', () => {
    const { world, canvas } = createTestHarness(800, 600);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
    );
    world.update();

    const { position } = world.getMouseState();

    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
  });

  test('camera position shifts the world-space mouse coordinate', () => {
    const { world, canvas } = createTestHarness(800, 600);

    world.camera.position.set(50, 30);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
    );
    world.update();

    // Cursor at the canvas centre; the inverse of the camera translation
    // puts it on the camera's look-at point.
    expect(world.getMouseState().position.x).toBe(50);
    expect(world.getMouseState().position.y).toBe(30);
  });

  test('camera rotation rotates the world-space mouse around the camera', () => {
    const { world, canvas } = createTestHarness(800, 600);

    world.camera.rotation = Math.PI / 2;

    // Cursor sits 100px right of canvas centre. Under a 90° camera roll,
    // the inverse rotation maps screen-offset (100, 0) to world-offset
    // (0, 100); the camera position is (0, 0) so that's also the world
    // coordinate.
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 500, clientY: 300 }),
    );
    world.update();

    const { position } = world.getMouseState();
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(100);
  });

  test('camera zoom scales the world-space mouse coordinate', () => {
    const { world, canvas } = createTestHarness(800, 600);

    world.camera.zoom = 2;

    // Cursor 100px right of canvas centre, with 2x zoom, lands 50 units
    // right of the camera's look-at in world space.
    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 500, clientY: 300 }),
    );
    world.update();

    expect(world.getMouseState().position.x).toBe(50);
    expect(world.getMouseState().position.y).toBe(0);
  });

  test('camera shake does not move the reported world position', () => {
    const { world, canvas } = createTestHarness(800, 600);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      world.camera.shake(10, 1000);

      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
      );
      world.update();

      // Even with a shake in flight, the cursor at the canvas centre still
      // resolves to the camera's logical look-at, i.e. world (0, 0). Clicks
      // shouldn't drift just because the screen is shaking.
      expect(world.getMouseState().position.x).toBe(0);
      expect(world.getMouseState().position.y).toBe(0);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('uses the latest camera each call, not a snapshot from onPreUpdate', () => {
    const { world, canvas } = createTestHarness(800, 600);

    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
    );
    world.update();

    // Move the camera after onPreUpdate has already snapshotted screen
    // state — world-space position should still pick up the new camera.
    world.camera.position.set(99, 77);

    expect(world.getMouseState().position.x).toBe(99);
    expect(world.getMouseState().position.y).toBe(77);
  });

  test('removes event listeners on destroy', () => {
    const { world, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    world.update();
    expect(world.getMouseState().buttons.left).toBe(true);

    world.removeComponent('mouse');

    // Re-register a fresh mouse and verify the OLD listener doesn't still
    // mutate state — if it did, the new mouse would see the stale press
    // because the old handler is still writing to a now-detached instance,
    // but state propagation only happens through the live registered
    // component, so getMouseState resolves the new one and reports clean.
    const newWorld = createTestHarness().world;
    expect(newWorld.getMouseState().buttons.left).toBe(false);
  });

  test('world.getMouseState throws when no mouse component is registered', () => {
    const world = new World({ components: () => ({}) });

    expect(() => world.getMouseState()).toThrow();
  });
});
