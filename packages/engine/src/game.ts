import { Application, ApplicationOptions } from 'pixi.js';
import {
  AbstractComponentHost,
  Component,
  ComponentFactoryMap,
} from './components';
import { ErrorCode, throwEngineError } from './error';
import { Scene } from './graphics';
import { Mouse, MouseSnapshot } from './input';
import { SCENE_COMPONENT_KEY, World, WorldOptions } from './world';

/**
 * Sizing strategy for the application's canvas.
 *
 * - `{ fill: 'window' }` — the canvas is sized to the browser window and
 *   updates on every `resize` event. Use for fullscreen-style games.
 * - `{ width, height }` — the canvas is created at a fixed pixel size and
 *   never resizes. Use for embedded views, prototypes, and anything that
 *   should occupy a known box on the page.
 *
 * Sizing is intentionally separated from the unrelated
 * {@link GameOptions.debug} flag — earlier iterations conflated "fill the
 * window" with "attach `game` to `window` for console access", which made
 * the option hard to opt into independently.
 */
export type GameCanvasOptions =
  | { readonly fill: 'window' }
  | { readonly width: number; readonly height: number };

/**
 * Options accepted by {@link Game.bootstrap}.
 *
 * The shape is intentionally narrow. Earlier iterations of the engine
 * accepted a raw `Partial<ApplicationOptions>` passthrough, but that leaked
 * the renderer's surface into the engine's public API and conflicted with
 * arcade2d's composition-over-exposure philosophy. New rendering knobs are
 * added one at a time, named in arcade2d terms.
 */
export type GameOptions = {
  /**
   * Background colour of the canvas, expressed as a PIXI-style 24-bit RGB
   * literal (e.g. `0x101820`). Defaults to `0x000000` (black).
   */
  readonly backgroundColour?: number;

  /**
   * Canvas sizing strategy. Defaults to a fixed 800x600 canvas. Pass
   * `{ fill: 'window' }` for a fullscreen-style game that tracks the
   * browser window size, or `{ width, height }` for a fixed-size view.
   *
   * See {@link GameCanvasOptions}.
   */
  readonly canvas?: GameCanvasOptions;

  /**
   * When `true`, attaches the {@link Game} instance to `window.game` so it
   * can be inspected from the browser console. Strictly a dev convenience;
   * has no other runtime effects. Defaults to `false`.
   */
  readonly debug?: boolean;

  /**
   * Factory map of game-scoped components to register on the {@link Game}
   * after the engine's own auto-attached infrastructure (currently
   * {@link Mouse}). Run as the final step of `bootstrap` so the user's
   * components see engine components as resolvable siblings.
   */
  readonly components?: (game: Game) => ComponentFactoryMap<Game>;
};

/**
 * Reserved component key the engine uses to register the {@link Mouse}
 * input sampler on every {@link Game}. Exposed as a constant so callers
 * that need to introspect or replace the mouse component (e.g. swapping in
 * a recorded-input variant for testing) don't have to hard-code a magic
 * string.
 */
export const MOUSE_COMPONENT_KEY = 'mouse';

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
    // components see them as resolvable siblings.
    this.addComponentsFromFactories({
      [MOUSE_COMPONENT_KEY]: () => new Mouse(this),
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
    options: Omit<WorldOptions, 'game' | 'components'> & {
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

    const world = new World({
      ...options,
      game: this,
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
