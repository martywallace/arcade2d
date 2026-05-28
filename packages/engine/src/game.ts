import { Application, ApplicationOptions, Container } from 'pixi.js';
import { AbstractComponentHost } from './abstract-component-host';
import { AssetLibrary } from './assets';
import { AUDIO_ENGINE_COMPONENT_KEY, AudioEngine } from './audio';
import type { Component } from './components.types';
import { ErrorCode } from './error.constants';
import { throwEngineError } from './error.support';
import {
  ASSET_LIBRARY_COMPONENT_KEY,
  KEYBOARD_COMPONENT_KEY,
  MOUSE_COMPONENT_KEY,
} from './game.constants';
import type { GameCanvasOptions, GameOptions } from './game.types';
import { Scene } from './graphics';
import { Keyboard, KeyboardState, Mouse, MouseSnapshot } from './input';
import { SCENE_COMPONENT_KEY, World, WorldOptions } from './world';

const DEFAULT_BACKGROUND_COLOUR = 0x000000;
const DEFAULT_CANVAS: GameCanvasOptions = { width: 800, height: 600 };

/**
 * Lifecycle phase in which a {@link Game} component callback was running
 * when it threw. Mirrors `WorldErrorPhase` for the game tier.
 *
 * @internal
 */
type GameErrorPhase =
  | 'component-pre-update'
  | 'component-update'
  | 'component-post-update'
  | 'component-destroy';

/**
 * Root container for an arcade2d application. A `Game` owns the renderer
 * (a PIXI {@link Application} under the hood), the per-frame ticker, and
 * everything else that is conceptually *outside* a {@link World} — input
 * samplers, audio mixers, asset registries, and similar page-scoped
 * services that don't belong to any individual simulation.
 *
 * A `Game` is the entry point. Real applications start with:
 *
 * ```typescript
 * const game = await Game.bootstrap({
 *   backgroundColour: 0x101820,
 *   canvas: { fill: 'window' },
 * });
 *
 * const world = game.createWorld({
 *   components: () => ({ ... }),
 * });
 * ```
 *
 * ## Lifecycle and the tick
 *
 * `Game` is itself a {@link AbstractComponentHost}, so any
 * {@link Component} attached to it goes through the standard
 * pre-update / update / post-update phases each frame. The order is:
 *
 * 1. `game.onPreUpdate` — every game component's pre-phase, in insertion
 *    order. Canonical use: input samplers snapshotting pending DOM event
 *    state so world-scoped code reads a consistent value all tick.
 * 2. `game.onUpdate` — every game component's main phase.
 * 3. `game.onPostUpdate` — every game component's post-phase.
 * 4. `world.update()` — if an active {@link World} exists, the engine
 *    drives its full three-phase tick. World-scoped reads of game state
 *    (e.g. {@link World.getMouseState}) therefore see values that were
 *    snapshotted during step 1.
 *
 * The PIXI ticker drives `Game.update`; user code never calls it directly.
 *
 * ## Worlds
 *
 * Only one world is active at a time. {@link Game.createWorld} constructs
 * it (auto-attaching a {@link Scene} and {@link import('./world').Camera}),
 * and {@link Game.destroyWorld} tears it down. Switching between
 * "menu" and "gameplay" worlds is the canonical use of this pair —
 * destroy, then create the next one. Attempting to create a second world
 * while one is already active throws
 * {@link ErrorCode.GAME_WORLD_ALREADY_EXISTS}; attempting to destroy when
 * no world is active throws {@link ErrorCode.GAME_WORLD_NOT_FOUND}.
 *
 * ## Cross-references
 *
 * - {@link GameOptions} — bootstrap-time configuration.
 * - {@link World} — the simulation tier driven by `Game.update`.
 * - {@link Mouse} — the auto-attached input sampler exposed via
 *   {@link Game.getMouseState}.
 */
export class Game extends AbstractComponentHost<Game> {
  /**
   * Creates and initialises a new {@link Game}. The async step is the PIXI
   * application's own `init()` — which constructs the WebGL/WebGPU context
   * and prepares the renderer. After it resolves, the canvas is appended to
   * `document.body` (when running in a browser), the engine's auto-attached
   * components are registered, the ticker is wired, and the returned
   * `Game` is ready to receive a {@link Game.createWorld} call.
   *
   * @param options Optional configuration. See {@link GameOptions}.
   */
  public static async bootstrap(options: GameOptions = {}): Promise<Game> {
    const app = new Application();

    const canvas = options.canvas ?? DEFAULT_CANVAS;
    const initOptions: Partial<ApplicationOptions> = {
      background: options.backgroundColour ?? DEFAULT_BACKGROUND_COLOUR,
    };

    if ('fill' in canvas) {
      // PIXI's `resizeTo` makes the renderer track the given element/window
      // and resize the canvas on every browser resize event — exactly what
      // "fill the window" implies, and the path that doesn't require us to
      // wire our own resize listener.
      initOptions.resizeTo = window;
    } else {
      initOptions.width = canvas.width;
      initOptions.height = canvas.height;
    }

    await app.init(initOptions);

    if (typeof document !== 'undefined') {
      document.body.appendChild(app.canvas);
    }

    return new Game(app, options);
  }

  /**
   * Synchronous test-only factory that constructs a {@link Game} backed by
   * a stub PIXI {@link Application}. No WebGL context, no canvas mounted
   * to the DOM, no ticker registered with a real renderer.
   *
   * ## When to use this
   *
   * **Unit tests and headless tooling only.** The engine's production
   * surface — every accessor that needs page-scoped services like the
   * mouse or keyboard — assumes a {@link Game} is present, so unit tests
   * that exercise a {@link World} in isolation need *something* to satisfy
   * the new mandatory `game` argument on the {@link World} constructor.
   * This factory exists to give those tests a cheap, synchronous game
   * without the cost of bootstrapping a real PIXI renderer.
   *
   * ## When **not** to use this
   *
   * - **Never in production game code.** The stub application does not
   *   render anything, does not run a ticker, does not own a canvas
   *   attached to the page. Anything that depends on actual draw output —
   *   `Scene`'s transform sync to the screen, `AbstractGraphics`'s
   *   parenting to the stage during real rendering, any code expecting
   *   `Game.update` to be driven by the PIXI ticker — will not behave
   *   correctly when the game is headless. Use {@link Game.bootstrap}
   *   instead, which performs the asynchronous WebGL/WebGPU init and
   *   mounts the canvas under `document.body`.
   * - **Not for renderer-level unit tests** that need to observe the real
   *   PIXI pipeline. Those should construct their own `Application` and
   *   pass it to the public `Game` constructor.
   *
   * The auto-attached {@link Mouse} and {@link Keyboard} components are
   * still registered on the returned game. In non-browser environments
   * (Node, jest's default `node` environment) their `typeof window`
   * guards short-circuit listener attachment, so they're effectively
   * inert — callable, but reporting empty input state.
   *
   * @param options Same shape as {@link Game.bootstrap}'s options.
   * `canvas` is ignored — the stub renderer has no canvas of its own.
   */
  public static createHeadless(options: GameOptions = {}): Game {
    return new Game(createStubApplication(), options);
  }

  private _activeWorld: World | null = null;
  private readonly _tickerCallback: () => void;

  /**
   * @param _application The initialised PIXI {@link Application} this game
   * drives. Held privately — game code should never touch PIXI directly,
   * and the few engine internals that need the application read it through
   * {@link Game.application}.
   * @param options The {@link GameOptions} passed to {@link Game.bootstrap}.
   */
  constructor(
    private readonly _application: Application,
    options: GameOptions = {},
  ) {
    super();

    // Engine's own auto-attached components run first so the user's
    // components see them as resolvable siblings. AudioEngine comes before
    // AssetLibrary so audio-asset loads can reach a decoded context through
    // game.audio without any registration-order gymnastics.
    this.addComponentsFromFactories({
      [MOUSE_COMPONENT_KEY]: () => new Mouse(this),
      [KEYBOARD_COMPONENT_KEY]: () => new Keyboard(this),
      [AUDIO_ENGINE_COMPONENT_KEY]: () => new AudioEngine(this, options.audio),
      [ASSET_LIBRARY_COMPONENT_KEY]: () => new AssetLibrary(this),
    });

    this.addComponentsFromFactories(options.components?.(this) ?? {});

    this._tickerCallback = () => this.update();
    this._application.ticker.add(this._tickerCallback);

    if (options.debug && typeof window !== 'undefined') {
      Object.assign(window, { game: this });
    }
  }

  /**
   * The underlying PIXI {@link Application}. Engine-internal use only —
   * the {@link Scene} component reads it during {@link Game.createWorld}
   * to mount the world's container under the application's stage, and the
   * {@link Mouse} component reads `application.canvas` for its DOM event
   * listeners. Game code should not depend on this accessor; doing so
   * couples your code to PIXI and forfeits the protections arcade2d's
   * composition layer provides.
   *
   * @internal
   */
  public get application(): Application {
    return this._application;
  }

  /**
   * The HTML canvas element that arcade2d renders into, owned by the
   * underlying PIXI application. Exposed for application-level concerns
   * that legitimately need the canvas — e.g. attaching a `contextmenu`
   * handler to suppress the browser's right-click menu over the game.
   */
  public get canvas(): HTMLCanvasElement {
    return this._application.canvas;
  }

  /**
   * The game's {@link AssetLibrary} — the page-scoped registry for loading,
   * caching, and retrieving textures (and, later, other resources). Assets
   * live at the game tier because they outlive any individual {@link World};
   * preload them here and reference them by key from world-scoped code.
   *
   * Requires the auto-attached {@link AssetLibrary} registered under
   * {@link ASSET_LIBRARY_COMPONENT_KEY}. If you removed it deliberately,
   * reading this accessor throws {@link ErrorCode.COMPONENT_NOT_FOUND}.
   *
   * @example
   * ```typescript
   * await game.assets.loadMany(
   *   ['sprites/player.png', 'tiles/wall.png'],
   *   { namespace: 'level-1' },
   * );
   * const world = game.createWorld({ ... });
   * ```
   */
  public get assets(): AssetLibrary {
    return this.getComponent<AssetLibrary>(ASSET_LIBRARY_COMPONENT_KEY);
  }

  /**
   * The game's {@link AudioEngine} — the page-scoped owner of the Web Audio
   * context, the master and per-category gain buses, and the seam used by
   * {@link AssetLibrary} to decode {@link AudioAsset}s and by audio
   * components ({@link AudioSource}, {@link Music}) to construct voices.
   *
   * Lives at the game tier because audio outlives any individual
   * {@link World}: a music track survives a world transition, and the
   * pause-menu volume sliders mutate a single set of buses.
   *
   * Requires the auto-attached {@link AudioEngine} registered under
   * {@link AUDIO_ENGINE_COMPONENT_KEY}. If you removed it deliberately,
   * reading this accessor throws {@link ErrorCode.COMPONENT_NOT_FOUND}.
   *
   * @example
   * ```typescript
   * game.audio.masterVolume = 0.5;
   * await game.audio.resume(); // unlock on first user gesture
   * ```
   */
  public get audio(): AudioEngine {
    return this.getComponent<AudioEngine>(AUDIO_ENGINE_COMPONENT_KEY);
  }

  /**
   * The currently active {@link World}, or `null` if no world has been
   * created (or the last one was destroyed). Most game code that needs the
   * world will close over the value returned by {@link Game.createWorld}
   * directly; this accessor is intended for higher-level orchestration
   * (scene-switching managers, dev tools).
   */
  public get activeWorld(): World | null {
    return this._activeWorld;
  }

  /**
   * Returns the current screen-space mouse snapshot — canvas-local cursor
   * position and the held/released state of the three standard buttons.
   * Independent of any world or camera; the same snapshot is visible to
   * menu UI and to gameplay code alike.
   *
   * For the world-space projection of the cursor (camera-transformed),
   * reach for `World.getMouseState` instead. This method exists so
   * code working entirely in screen space (overlays, HUDs, intro menus
   * with no world yet) doesn't have to construct a world to read the
   * pointer.
   *
   * Allocates a fresh {@link MouseSnapshot} (and a fresh {@link Point} for
   * `screenPosition`) per call so callers can safely stash the result.
   *
   * Requires the auto-attached {@link Mouse} component registered under
   * {@link MOUSE_COMPONENT_KEY}. If you removed it deliberately, calling
   * this method throws {@link ErrorCode.COMPONENT_NOT_FOUND}.
   */
  public getMouseState(): MouseSnapshot {
    return this.getComponent<Mouse>(MOUSE_COMPONENT_KEY).getState();
  }

  /**
   * Returns the current keyboard state — the set of physical keys held at
   * tick-snapshot time, plus a `isDown(code)` predicate for membership
   * tests. Page-global; the same snapshot is visible to menu UI and to
   * gameplay code alike.
   *
   * Keys are identified by `KeyboardEvent.code` (the physical key, not
   * the logical character) so movement bindings like `KeyW`/`KeyA`/
   * `KeyS`/`KeyD` keep working across keyboard layouts. See
   * {@link KeyboardState} for the convention and a pointer to MDN's
   * full code-value list.
   *
   * Allocates a fresh {@link KeyboardState} (with a freshly-cloned
   * `downKeys` set) per call so callers can safely stash the result.
   *
   * Requires the auto-attached {@link Keyboard} component registered
   * under {@link KEYBOARD_COMPONENT_KEY}. If you removed it deliberately,
   * calling this method throws {@link ErrorCode.COMPONENT_NOT_FOUND}.
   */
  public getKeyboardState(): KeyboardState {
    return this.getComponent<Keyboard>(KEYBOARD_COMPONENT_KEY).getState();
  }

  /**
   * Creates a new {@link World} and marks it as the active world for this
   * `Game`. The engine auto-attaches a {@link Scene} (parented to the PIXI
   * application's stage) and a `Camera` to every world it creates, so the
   * user's component factory sees both as already-resolvable siblings.
   *
   * Only one world may be active at a time. Calling this method while a
   * world already exists throws {@link ErrorCode.GAME_WORLD_ALREADY_EXISTS};
   * destroy the existing one first via {@link Game.destroyWorld}.
   *
   * @param options Per-world configuration. Same shape as
   * {@link WorldOptions} but with `components` defaulted to an empty
   * factory so callers that want only the engine defaults can pass `{}`.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.GAME_WORLD_ALREADY_EXISTS} when an active world
   *   already exists on this game.
   *
   * @example
   * ```typescript
   * const world = game.createWorld({
   *   components: (world) => ({
   *     physics: () => new PhysicsSystem(world),
   *   }),
   *   prefabs: prefabRegistry,
   * });
   * ```
   */
  public createWorld(
    options: Omit<WorldOptions, 'components'> & {
      readonly components?: WorldOptions['components'];
    } = {},
  ): World {
    if (this._activeWorld) {
      throwEngineError(
        ErrorCode.GAME_WORLD_ALREADY_EXISTS,
        'Cannot create a new World — this Game already has an active World. ' +
          'Call game.destroyWorld() first if you want to replace it.',
        { game: this },
      );
    }

    const userComponents = options.components ?? (() => ({}));
    const app = this._application;

    const world = new World(this, {
      ...options,
      components: (w) => ({
        // Engine auto-attached components come first so the user's
        // factories run against a world that already has a Scene.
        [SCENE_COMPONENT_KEY]: () => new Scene(w, app),
        ...userComponents(w),
      }),
    });

    this._activeWorld = world;

    return world;
  }

  /**
   * Destroys the active world, releasing this `Game`'s reference to it.
   * Equivalent to calling `world.destroy()` and then clearing
   * {@link Game.activeWorld}, in that order — the world's components and
   * objects all see their `onDestroy` hooks fire as part of the call.
   *
   * Subsequent {@link Game.createWorld} calls succeed because the active
   * world slot is now empty.
   *
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.GAME_WORLD_NOT_FOUND} when no world is currently
   *   active.
   */
  public destroyWorld(): void {
    if (!this._activeWorld) {
      throwEngineError(
        ErrorCode.GAME_WORLD_NOT_FOUND,
        'Cannot destroy World — this Game has no active World.',
        { game: this },
      );
    }

    this._activeWorld.destroy();
    this._activeWorld = null;
  }

  /**
   * Tears the game down completely: destroys the active world (if any),
   * runs `onDestroy` on every game component, unhooks the PIXI ticker, and
   * destroys the underlying PIXI application. The {@link Game} instance is
   * not reusable after this call.
   *
   * Idempotent in the same sense as {@link World.destroy} — calling it
   * twice is safe and the second call is a no-op.
   */
  public destroy(): void {
    if (this._activeWorld) {
      this._activeWorld.destroy();
      this._activeWorld = null;
    }

    this.removeAllComponents();

    this._application.ticker.remove(this._tickerCallback);
    this._application.destroy(true, { children: true });
  }

  /**
   * Runs the game's per-frame tick: every game component's pre/update/post
   * phase in order, then delegates to the active world's `update()` if one
   * exists. Wired to the PIXI ticker during construction, so user code
   * almost never calls this method directly; it's `public` only so tests
   * (and the rare callers that disable the ticker for deterministic
   * stepping) can drive a single tick on demand.
   */
  public update(): void {
    this._runComponentPhase('onPreUpdate', 'component-pre-update');
    this._runComponentPhase('onUpdate', 'component-update');
    this._runComponentPhase('onPostUpdate', 'component-post-update');

    if (this._activeWorld) {
      this._activeWorld.update();
    }
  }

  protected getHostReference(): Game {
    return this;
  }

  protected override _createDependencyResolver(): unknown {
    // No game-tier dependency resolver yet — game components currently
    // have no declared dependencies. When that changes, this hook is the
    // place to construct one. For now, returning an empty object is fine
    // because `Component.resolveDependencies` is only invoked when the
    // component implements it, and none of the engine's game components
    // do.
    return {};
  }

  protected override _handleComponentDestroyError(
    error: unknown,
    key: string,
  ): void {
    console.error(
      `[arcade2d] game component "${key}" threw during onDestroy:`,
      error,
    );
  }

  /**
   * Iterates this game's own components and invokes the named phase
   * method on each, isolating throws so a single bad component does not
   * abort the tick. Mirrors the world-tier phase runner.
   */
  private _runComponentPhase(
    method: 'onPreUpdate' | 'onUpdate' | 'onPostUpdate',
    errorPhase: GameErrorPhase,
  ): void {
    if (!this.enabled) {
      return;
    }

    for (const [key, component] of this.components) {
      if (component.enabled === false) {
        continue;
      }

      const hook = (component as Component<Game>)[method];

      if (!hook) {
        continue;
      }

      const deps = this._getDepsFor(component);

      try {
        // Game components don't receive a WorldUpdate — that payload is a
        // world-tier concept. The cast here matches the structural
        // Component<THost> interface which types the first hook arg as
        // WorldUpdate; long-term we will introduce a GameUpdate payload
        // (frame index, delta) but for now the engine's only game
        // component (Mouse) ignores the argument entirely.
        (hook as (update: unknown, deps: unknown) => void).call(
          component,
          undefined,
          deps,
        );
      } catch (error) {
        console.error(
          `[arcade2d] game component "${key}" threw during ${errorPhase}:`,
          error,
        );
      }
    }
  }
}

/**
 * Default canvas width used by the stub application produced by
 * {@link Game.createHeadless}. Mirrors the production default in
 * {@link GameOptions.canvas}.
 *
 * @internal
 */
const HEADLESS_SCREEN_WIDTH = 800;

/**
 * Default canvas height used by the stub application produced by
 * {@link Game.createHeadless}.
 *
 * @internal
 */
const HEADLESS_SCREEN_HEIGHT = 600;

/**
 * Builds a minimal PIXI {@link Application} stand-in used by
 * {@link Game.createHeadless}. Provides the smallest surface the {@link Game}
 * constructor and the engine's auto-attached components touch — the ticker
 * (no-op add/remove), the canvas (a duck-typed EventTarget the {@link Mouse}
 * can attach listeners to), the screen bounds, the stage container, and a
 * destroy hook — without spinning up a renderer.
 *
 * @internal
 */
function createStubApplication(): Application {
  const noopEventTarget = {
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    getBoundingClientRect: (): DOMRect => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: (): unknown => ({}),
    }),
  };

  return {
    canvas: noopEventTarget,
    screen: { width: HEADLESS_SCREEN_WIDTH, height: HEADLESS_SCREEN_HEIGHT },
    stage: new Container(),
    ticker: { add: (): void => {}, remove: (): void => {} },
    destroy: (): void => {},
  } as unknown as Application;
}
