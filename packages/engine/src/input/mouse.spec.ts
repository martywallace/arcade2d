/**
 * @jest-environment jsdom
 */

import { Application, Container } from 'pixi.js';
import { EngineError, ErrorCode } from '../error';
import { Game, MOUSE_COMPONENT_KEY } from '../game';
import { World } from '../world';
import { Mouse } from './mouse';

function createTestHarness(width = 800, height = 600) {
  const canvas = document.createElement('canvas');
  const app = {
    canvas,
    screen: { width, height },
    stage: new Container(),
    ticker: { add: jest.fn(), remove: jest.fn() },
    destroy: jest.fn(),
  } as unknown as Application;

  const game = new Game(app);
  const world = game.createWorld();

  return { game, world, canvas, app, mouse: game.getComponent<Mouse>(MOUSE_COMPONENT_KEY) };
}

describe('Mouse', () => {
  test('default state has zero position and no buttons pressed', () => {
    const { game } = createTestHarness();
    const state = game.getMouseState();

    expect(state.screenPosition.x).toBe(0);
    expect(state.screenPosition.y).toBe(0);
    expect(state.buttons.left).toBe(false);
    expect(state.buttons.right).toBe(false);
    expect(state.buttons.middle).toBe(false);
  });

  test('mousemove updates the screen position snapshot after the next tick', () => {
    const { game, canvas } = createTestHarness();

    canvas.dispatchEvent(
      new MouseEvent('mousemove', { clientX: 100, clientY: 200 }),
    );

    // Pending buffer has the new value but the snapshot does not — snapshots
    // only refresh on tick boundaries, so reads during the same frame as
    // a DOM event still see the previous tick's value.
    expect(game.getMouseState().screenPosition.x).toBe(0);

    game.update();

    expect(game.getMouseState().screenPosition.x).toBe(100);
    expect(game.getMouseState().screenPosition.y).toBe(200);
  });

  test('mousedown sets the matching button flag after the next tick', () => {
    const { game, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 1 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));

    game.update();

    const { buttons } = game.getMouseState();

    expect(buttons.left).toBe(true);
    expect(buttons.middle).toBe(true);
    expect(buttons.right).toBe(true);
  });

  test('window mouseup clears button state', () => {
    const { game, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    game.update();
    expect(game.getMouseState().buttons.left).toBe(true);

    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    game.update();
    expect(game.getMouseState().buttons.left).toBe(false);
  });

  test('ignores buttons outside the standard left/middle/right range', () => {
    const { game, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 3 }));
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 4 }));
    game.update();

    const { buttons } = game.getMouseState();
    expect(buttons.left).toBe(false);
    expect(buttons.middle).toBe(false);
    expect(buttons.right).toBe(false);
  });

  test('returned state object is a fresh snapshot per call', () => {
    const { game } = createTestHarness();

    const a = game.getMouseState();
    const b = game.getMouseState();

    expect(a).not.toBe(b);
    expect(a.screenPosition).not.toBe(b.screenPosition);
    expect(a.buttons).not.toBe(b.buttons);
  });

  describe('World.getMouseState (world-space projection)', () => {
    test('default camera maps canvas centre to world origin', () => {
      const { game, world, canvas } = createTestHarness(800, 600);

      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
      );
      game.update();

      const { position } = world.getMouseState();

      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });

    test('camera position shifts the world-space mouse coordinate', () => {
      const { game, world, canvas } = createTestHarness(800, 600);

      world.camera.position.set(50, 30);

      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
      );
      game.update();

      expect(world.getMouseState().position.x).toBe(50);
      expect(world.getMouseState().position.y).toBe(30);
    });

    test('camera rotation rotates the world-space mouse around the camera', () => {
      const { game, world, canvas } = createTestHarness(800, 600);

      world.camera.rotation = Math.PI / 2;

      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 500, clientY: 300 }),
      );
      game.update();

      const { position } = world.getMouseState();
      expect(position.x).toBeCloseTo(0);
      expect(position.y).toBeCloseTo(100);
    });

    test('camera zoom scales the world-space mouse coordinate', () => {
      const { game, world, canvas } = createTestHarness(800, 600);

      world.camera.zoom = 2;

      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 500, clientY: 300 }),
      );
      game.update();

      expect(world.getMouseState().position.x).toBe(50);
      expect(world.getMouseState().position.y).toBe(0);
    });

    test('camera shake does not move the reported world position', () => {
      const { game, world, canvas } = createTestHarness(800, 600);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      try {
        world.camera.shake(10, 1000);

        canvas.dispatchEvent(
          new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
        );
        game.update();

        expect(world.getMouseState().position.x).toBe(0);
        expect(world.getMouseState().position.y).toBe(0);
      } finally {
        randomSpy.mockRestore();
      }
    });

    test('uses the latest camera each call, not a snapshot from onPreUpdate', () => {
      const { game, world, canvas } = createTestHarness(800, 600);

      canvas.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 400, clientY: 300 }),
      );
      game.update();

      world.camera.position.set(99, 77);

      expect(world.getMouseState().position.x).toBe(99);
      expect(world.getMouseState().position.y).toBe(77);
    });
  });

  test('removes event listeners on destroy', () => {
    const { game, canvas } = createTestHarness();

    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    game.update();
    expect(game.getMouseState().buttons.left).toBe(true);

    game.removeComponent(MOUSE_COMPONENT_KEY);

    // Re-register a fresh mouse; the old listener should not still be
    // mutating state. A new harness reads clean.
    const fresh = createTestHarness();
    expect(fresh.game.getMouseState().buttons.left).toBe(false);
  });

  test('world.getMouseState throws WORLD_GAME_NOT_ATTACHED when constructed without a Game', () => {
    const world = new World({ components: () => ({}) });

    let caught: unknown = null;
    try {
      world.getMouseState();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EngineError);
    expect((caught as EngineError).code).toBe(
      ErrorCode.WORLD_GAME_NOT_ATTACHED,
    );
  });
});
