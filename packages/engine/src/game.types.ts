import type { AudioEngineOptions } from './audio/audio-engine.types';
import type { ComponentFactoryMap } from './components.types';
import type { Game } from './game';

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
   * Configuration threaded into the auto-attached {@link AudioEngine}.
   * Pass `{ disabled: true }` to force the engine into headless mode in
   * tests, or initial bus levels to start at non-default volumes.
   */
  readonly audio?: AudioEngineOptions;

  /**
   * Factory map of game-scoped components to register on the {@link Game}
   * after the engine's own auto-attached infrastructure (currently
   * {@link Mouse}). Run as the final step of `bootstrap` so the user's
   * components see engine components as resolvable siblings.
   */
  readonly components?: (game: Game) => ComponentFactoryMap<Game>;
};
