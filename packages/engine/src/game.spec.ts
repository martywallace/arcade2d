/**
 * @jest-environment jsdom
 */

import { Application, Container } from 'pixi.js';
import type { Component } from './components.types';
import { EngineError } from './error';
import { ErrorCode } from './error.constants';
import { Game } from './game';
import { MOUSE_COMPONENT_KEY } from './game.constants';
import { Scene } from './graphics';
import { Mouse } from './input';
import {
  CAMERA_COMPONENT_KEY,
  SCENE_COMPONENT_KEY,
  WorldDependencyResolver,
} from './world';

function createFakeApp(width = 800, height = 600): Application {
  return {
    canvas: document.createElement('canvas'),
    screen: { width, height },
    stage: new Container(),
    ticker: { add: jest.fn(), remove: jest.fn() },
    destroy: jest.fn(),
  } as unknown as Application;
}

describe('Game', () => {
  describe('construction', () => {
    test('auto-attaches Mouse under MOUSE_COMPONENT_KEY', () => {
      const game = new Game(createFakeApp());

      expect(game.hasComponent(MOUSE_COMPONENT_KEY)).toBe(true);
      expect(game.getComponent(MOUSE_COMPONENT_KEY)).toBeInstanceOf(Mouse);
    });

    test('wires its update callback to the PIXI ticker', () => {
      const app = createFakeApp();
      const tickerAdd = app.ticker.add as jest.Mock;

      new Game(app);

      expect(tickerAdd).toHaveBeenCalledTimes(1);
    });

    test('passes the game instance into the user-provided component factory', () => {
      let seenHost: Game | null = null;

      const game = new Game(createFakeApp(), {
        components: (g) => {
          seenHost = g;
          return {};
        },
      });

      expect(seenHost).toBe(game);
    });

    test('registers user game components after the engine defaults', () => {
      class Custom implements Component<Game> {
        constructor(public readonly host: Game) {}
        onAdded(): void {}
        onUpdate(): void {}
        onDestroy(): void {}
      }

      const game = new Game(createFakeApp(), {
        components: () => ({
          custom: (g) => new Custom(g),
        }),
      });

      expect(game.hasComponent('custom')).toBe(true);
    });
  });

  describe('createWorld / destroyWorld', () => {
    test('createWorld returns a World, sets activeWorld, and auto-attaches Scene + Camera', () => {
      const game = new Game(createFakeApp());

      const world = game.createWorld();

      expect(game.activeWorld).toBe(world);
      expect(world.hasComponent(SCENE_COMPONENT_KEY)).toBe(true);
      expect(world.hasComponent(CAMERA_COMPONENT_KEY)).toBe(true);
    });

    test('createWorld threads the game instance through to world.game', () => {
      const game = new Game(createFakeApp());

      const world = game.createWorld();

      expect(world.game).toBe(game);
    });

    test('createWorld throws GAME_WORLD_ALREADY_EXISTS when one is already active', () => {
      const game = new Game(createFakeApp());
      game.createWorld();

      let caught: unknown = null;
      try {
        game.createWorld();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(
        ErrorCode.GAME_WORLD_ALREADY_EXISTS,
      );
    });

    test('destroyWorld tears the world down and clears the active slot', () => {
      const game = new Game(createFakeApp());
      const world = game.createWorld();
      const object = world.createEmpty();

      game.destroyWorld();

      expect(game.activeWorld).toBeNull();
      expect(object.destroyed).toBe(true);
    });

    test('destroyWorld throws GAME_WORLD_NOT_FOUND when no world is active', () => {
      const game = new Game(createFakeApp());

      let caught: unknown = null;
      try {
        game.destroyWorld();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EngineError);
      expect((caught as EngineError).code).toBe(ErrorCode.GAME_WORLD_NOT_FOUND);
    });

    test('a fresh createWorld succeeds after destroyWorld', () => {
      const game = new Game(createFakeApp());
      game.createWorld();
      game.destroyWorld();

      const next = game.createWorld();

      expect(game.activeWorld).toBe(next);
    });

    test('user components can resolve Scene as a sibling dependency', () => {
      const game = new Game(createFakeApp());

      let resolved: Scene | null = null;
      game.createWorld({
        components: (world) => ({
          inspector: () => ({
            host: world,
            onAdded: () => {},
            onUpdate: () => {},
            onDestroy: () => {},
            resolveDependencies: (resolver: WorldDependencyResolver) => {
              resolved = resolver.requireSibling(Scene);
              return {};
            },
          }),
        }),
      });

      expect(resolved).toBeInstanceOf(Scene);
    });
  });

  describe('update', () => {
    test('runs game components before the active world tick', () => {
      const order: string[] = [];

      const game = new Game(createFakeApp(), {
        components: () => ({
          tracker: (host) => ({
            host,
            onAdded: () => {},
            onPreUpdate: () => order.push('game-pre'),
            onUpdate: () => order.push('game-update'),
            onPostUpdate: () => order.push('game-post'),
            onDestroy: () => {},
          }),
        }),
      });

      const world = game.createWorld({
        components: (w) => ({
          tracker: () => ({
            host: w,
            onAdded: () => {},
            onUpdate: () => order.push('world-update'),
            onDestroy: () => {},
          }),
        }),
      });

      game.update();
      void world;

      expect(order).toEqual([
        'game-pre',
        'game-update',
        'game-post',
        'world-update',
      ]);
    });

    test('does not call world.update when there is no active world', () => {
      const game = new Game(createFakeApp());

      // No throw, no error — game just ticks its own components.
      expect(() => game.update()).not.toThrow();
    });

    test('isolates throws from game components, logging instead of aborting', () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        let goodRan = false;
        const game = new Game(createFakeApp(), {
          components: () => ({
            bad: (host) => ({
              host,
              onAdded: () => {},
              onUpdate: () => {
                throw new Error('boom');
              },
              onDestroy: () => {},
            }),
            good: (host) => ({
              host,
              onAdded: () => {},
              onUpdate: () => {
                goodRan = true;
              },
              onDestroy: () => {},
            }),
          }),
        });

        game.update();

        expect(goodRan).toBe(true);
        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('createHeadless', () => {
    test('returns a Game without bootstrapping a real renderer', () => {
      const game = Game.createHeadless();

      expect(game).toBeInstanceOf(Game);
      // Auto-attached infrastructure is still registered.
      expect(game.hasComponent(MOUSE_COMPONENT_KEY)).toBe(true);
    });

    test('the stub application supports the full createWorld flow', () => {
      const game = Game.createHeadless();

      const world = game.createWorld();

      expect(game.activeWorld).toBe(world);
      expect(world.hasComponent(SCENE_COMPONENT_KEY)).toBe(true);
      expect(world.hasComponent(CAMERA_COMPONENT_KEY)).toBe(true);
    });

    test('update ticks game components without throwing', () => {
      const game = Game.createHeadless();

      expect(() => game.update()).not.toThrow();
    });

    test('destroy tears down the stub application cleanly', () => {
      const game = Game.createHeadless();
      game.createWorld();

      expect(() => game.destroy()).not.toThrow();
      expect(game.activeWorld).toBeNull();
    });
  });

  describe('destroy', () => {
    test('destroys the active world, removes the ticker callback, and tears down PIXI', () => {
      const app = createFakeApp();
      const tickerRemove = app.ticker.remove as jest.Mock;
      const appDestroy = app.destroy as jest.Mock;
      const game = new Game(app);
      game.createWorld();

      game.destroy();

      expect(game.activeWorld).toBeNull();
      expect(tickerRemove).toHaveBeenCalledTimes(1);
      expect(appDestroy).toHaveBeenCalledTimes(1);
    });
  });
});
