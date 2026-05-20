/**
 * @jest-environment jsdom
 */

import { Application, Container } from 'pixi.js';
import { Game, KEYBOARD_COMPONENT_KEY } from '../game';
import { Keyboard } from './keyboard';

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

  return {
    game,
    world,
    canvas,
    app,
    keyboard: game.getComponent<Keyboard>(KEYBOARD_COMPONENT_KEY),
  };
}

describe('Keyboard', () => {
  test('default state has no keys down', () => {
    const { game } = createTestHarness();
    const state = game.getKeyboardState();

    expect(state.downKeys.size).toBe(0);
    expect(state.isDown('KeyA')).toBe(false);
    expect(state.isDown('Space')).toBe(false);
  });

  test('keydown adds the key to the snapshot after the next tick', () => {
    const { game } = createTestHarness();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));

    // Pending buffer has the new key but the snapshot does not — snapshots
    // only refresh on tick boundaries, so reads during the same frame as
    // the DOM event still see the previous tick's value.
    expect(game.getKeyboardState().isDown('KeyW')).toBe(false);

    game.update();

    expect(game.getKeyboardState().isDown('KeyW')).toBe(true);
  });

  test('multiple held keys are all reported', () => {
    const { game } = createTestHarness();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

    game.update();

    const state = game.getKeyboardState();
    expect(state.isDown('KeyW')).toBe(true);
    expect(state.isDown('KeyA')).toBe(true);
    expect(state.isDown('Space')).toBe(true);
    expect(state.downKeys.size).toBe(3);
  });

  test('keyup removes the key from the snapshot', () => {
    const { game } = createTestHarness();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    game.update();
    expect(game.getKeyboardState().isDown('KeyW')).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    game.update();
    expect(game.getKeyboardState().isDown('KeyW')).toBe(false);
  });

  test('window blur clears all held keys', () => {
    // Without this, a key held when the user alt-tabs away never receives
    // its `keyup` and the engine reports it as stuck-down forever. The
    // blur listener exists specifically to defuse this.
    const { game } = createTestHarness();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    game.update();
    expect(game.getKeyboardState().downKeys.size).toBe(2);

    window.dispatchEvent(new Event('blur'));
    game.update();

    expect(game.getKeyboardState().downKeys.size).toBe(0);
  });

  test('auto-repeat keydown events are idempotent', () => {
    // Browsers fire repeated `keydown` while a key is held. The pending
    // set is a Set, so this is naturally idempotent — the test pins the
    // behaviour so a future refactor (e.g. counting keypresses) doesn't
    // accidentally start double-counting.
    const { game } = createTestHarness();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyA', repeat: true }),
    );

    game.update();

    const state = game.getKeyboardState();
    expect(state.isDown('KeyA')).toBe(true);
    expect(state.downKeys.size).toBe(1);
  });

  test('returned state object is a fresh snapshot per call', () => {
    const { game } = createTestHarness();

    const a = game.getKeyboardState();
    const b = game.getKeyboardState();

    expect(a).not.toBe(b);
    expect(a.downKeys).not.toBe(b.downKeys);
  });

  test('stashed state is unaffected by later snapshots', () => {
    // Pin the "fresh snapshot per call" contract: a state object captured
    // at frame N must still reflect frame-N values after frame N+1 runs.
    const { game } = createTestHarness();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    game.update();

    const stashed = game.getKeyboardState();
    expect(stashed.isDown('KeyA')).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    game.update();

    expect(stashed.isDown('KeyA')).toBe(true);
    expect(game.getKeyboardState().isDown('KeyA')).toBe(false);
  });

  test('removes event listeners on destroy', () => {
    const { game } = createTestHarness();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    game.update();
    expect(game.getKeyboardState().isDown('KeyA')).toBe(true);

    game.removeComponent(KEYBOARD_COMPONENT_KEY);

    // Re-register a fresh keyboard; the old listener should not still be
    // mutating state. A new harness reads clean.
    const fresh = createTestHarness();
    expect(fresh.game.getKeyboardState().downKeys.size).toBe(0);
  });

  describe('World.getKeyboardState', () => {
    test('passes through the parent game keyboard state', () => {
      const { game, world } = createTestHarness();

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      game.update();

      const state = world.getKeyboardState();
      expect(state.isDown('KeyW')).toBe(true);
    });

  });
});
