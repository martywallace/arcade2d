import type { FontAsset } from '../assets/font-asset';
import type { TexturedGraphicsOptions } from './abstract-textured-graphics.types';

/**
 * Horizontal alignment for the lines inside a {@link Text}. Mirrors the
 * canvas-text aligns the renderer accepts, narrowed to the three values
 * that make sense for left-to-right Latin scripts. The setting only affects
 * multi-line text — a single-line string ignores it.
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Construction-time configuration for a {@link Text}. Extends the shared
 * {@link TexturedGraphicsOptions} (`anchor`, `tint`, `alpha`, `visible`) with
 * the typographic settings. Note `fill` is the glyph colour, while the
 * inherited `tint` multiplies on top of it. Every field is optional; an
 * omitted field takes the documented default.
 */
export interface TextOptions extends TexturedGraphicsOptions {
  /**
   * Font family the text is drawn in. Accepts either a {@link FontAsset} —
   * preloaded via {@link AssetLibrary.load} — whose
   * {@link FontAsset.family} is read, or a raw CSS family string for
   * system fonts (`'monospace'`, `'Arial, sans-serif'`).
   *
   * Defaults to `'sans-serif'`, which is the platform's default
   * proportional family. Prefer passing a loaded {@link FontAsset} for any
   * production text so the rendered output is deterministic across
   * machines.
   */
  readonly fontFamily?: FontAsset | string;

  /**
   * Font size in pixels. Defaults to `16`.
   *
   * Note that this is the typographic size, not a width/height — scaling
   * a {@link Text} by setting `host.scale` will resample the underlying
   * texture and look soft. Choose a `fontSize` close to the size you
   * actually want on screen, and leave the host's scale at `(1, 1)`.
   */
  readonly fontSize?: number;

  /**
   * Fill colour of the glyphs. Either a 24-bit RGB integer (`0xff0000` for
   * red) or a CSS colour string (`'#ff0000'`, `'red'`). Defaults to
   * `0xffffff` (white).
   */
  readonly fill?: number | string;

  /**
   * Horizontal alignment of lines within a multi-line {@link Text}.
   * Defaults to `'left'`. Ignored for single-line text — to position a
   * single line, set its host's `position` or its `anchor`.
   */
  readonly align?: TextAlign;
}
