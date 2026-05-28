import { Text as PixiText } from 'pixi.js';
import { FontAsset } from '../assets/font-asset';
import { Point } from '../geometry';
import { WorldObject } from '../world';
import { AbstractGraphics } from './abstract-graphics';
import type { TextAlign, TextOptions } from './text.types';

/**
 * Renders a string attached to a {@link WorldObject} — the standard way to
 * put dynamic text on screen.
 *
 * `Text` wraps a renderer `Text` internally and builds on
 * {@link AbstractGraphics}, so it inherits the scene-parenting and
 * once-per-frame transform sync every graphics component gets: the text
 * tracks the host's position, rotation, and scale automatically. What it
 * adds is the typographic surface — the string, font family, size, fill,
 * alignment, anchor, and opacity.
 *
 * ## World-space, not screen-space
 *
 * Like every other graphics component, `Text` lives in the world's scene
 * graph and is therefore affected by the {@link Camera}. To draw a
 * screen-anchored HUD label, position the host each frame to follow the
 * camera — `host.position = camera.position + offset` — rather than
 * expecting `Text` to opt out of the camera transform. The matching engine
 * surface for menus and DOM-native UI is a React/HTML overlay, not a
 * special text component.
 *
 * ## Sizing
 *
 * Text is sized by its {@link TextOptions.fontSize} — a pixel-space
 * typographic size — not by `host.scale`. Scaling a `Text` via the host's
 * scale resamples the underlying texture and looks soft; instead, pick a
 * `fontSize` close to the size you want on screen, and leave the host's
 * scale at `(1, 1)`. The per-frame transform sync inherited from
 * {@link AbstractGraphics} still applies, so any host scale you do set
 * will multiply on top of the typographic size.
 *
 * ## Font selection
 *
 * Pass {@link TextOptions.fontFamily} as a preloaded {@link FontAsset} for
 * any production text — the asset's {@link FontAsset.family} is read,
 * keeping the rendered output deterministic across machines. A raw CSS
 * family string is accepted as an escape hatch for system fonts during
 * prototyping.
 *
 * @example
 * ```ts
 * const hud = world.createObject();
 * const pixel = game.assets.getAs('pixel', FontAsset);
 *
 * hud.addComponentFromFactory(
 *   'score',
 *   (host) =>
 *     new Text(host, 'Score: 0', {
 *       fontFamily: pixel,
 *       fontSize: 16,
 *       fill: 0xffffff,
 *       anchor: 0,
 *     }),
 * );
 * ```
 *
 * @see {@link FontAsset} for the font handle this component renders against.
 * @see {@link AbstractGraphics} for the inherited lifecycle and transform sync.
 */
export class Text extends AbstractGraphics<PixiText> {
  /**
   * @param host The {@link WorldObject} this text is attached to. Its
   * transform drives the text's position, rotation, and scale each frame.
   * @param text The initial string to render. Use `\n` for line breaks.
   * @param options Optional {@link TextOptions} (font family, size, fill,
   * anchor, alignment, opacity, visibility).
   */
  constructor(host: WorldObject, text: string, options: TextOptions = {}) {
    const fontFamily =
      options.fontFamily instanceof FontAsset
        ? options.fontFamily.family
        : (options.fontFamily ?? 'sans-serif');

    const display = new PixiText({
      text,
      style: {
        fontFamily,
        fontSize: options.fontSize ?? 16,
        fill: options.fill ?? 0xffffff,
        align: options.align ?? 'left',
      },
    });

    const anchor = options.anchor ?? 0.5;
    if (typeof anchor === 'number') {
      display.anchor.set(anchor, anchor);
    } else {
      display.anchor.set(anchor.x, anchor.y);
    }

    display.alpha = options.alpha ?? 1;
    display.visible = options.visible ?? true;

    super(host, display);
  }

  /**
   * The rendered string. Setting this re-rasterises the underlying
   * texture; setting it to the same value the text already holds is a
   * cheap no-op in the renderer.
   */
  public get text(): string {
    return this.raw.text;
  }

  public set text(value: string) {
    this.raw.text = value;
  }

  /**
   * Replaces the rendered string.
   *
   * @param value The string to display. Use `\n` for line breaks.
   */
  public setText(value: string): void {
    this.raw.text = value;
  }

  /**
   * The font family the text is drawn in, as a CSS family string. To swap
   * families pass either a {@link FontAsset} or a raw string to
   * {@link Text.setFontFamily}.
   */
  public get fontFamily(): string {
    const family = this.raw.style.fontFamily;
    return Array.isArray(family) ? family.join(', ') : family;
  }

  /**
   * Swaps the font family.
   *
   * @param value A preloaded {@link FontAsset} (whose
   * {@link FontAsset.family} is read) or a raw CSS family string.
   */
  public setFontFamily(value: FontAsset | string): void {
    this.raw.style.fontFamily =
      value instanceof FontAsset ? value.family : value;
  }

  /**
   * Font size in pixels. See {@link TextOptions.fontSize} for the sizing
   * model — scaling via `fontSize` looks crisp, scaling via `host.scale`
   * does not.
   */
  public get fontSize(): number {
    return this.raw.style.fontSize as number;
  }

  public set fontSize(value: number) {
    this.raw.style.fontSize = value;
  }

  /**
   * Fill colour of the glyphs. Always returns the underlying canvas-text
   * fill value; for the colour models the renderer accepts on assignment,
   * see {@link TextOptions.fill}.
   */
  public get fill(): number | string {
    return this.raw.style.fill as number | string;
  }

  public set fill(value: number | string) {
    this.raw.style.fill = value;
  }

  /**
   * Horizontal alignment of lines within a multi-line text. See
   * {@link TextOptions.align}.
   */
  public get align(): TextAlign {
    return this.raw.style.align as TextAlign;
  }

  public set align(value: TextAlign) {
    this.raw.style.align = value;
  }

  /**
   * Opacity from `0` (transparent) to `1` (opaque). See
   * {@link TextOptions.alpha}.
   */
  public get alpha(): number {
    return this.raw.alpha;
  }

  public set alpha(value: number) {
    this.raw.alpha = value;
  }

  /**
   * Whether the text is drawn. A hidden text still ticks and stays
   * transform-synced; it is just skipped by the renderer.
   */
  public get visible(): boolean {
    return this.raw.visible;
  }

  public set visible(value: boolean) {
    this.raw.visible = value;
  }

  /**
   * The anchor point as a fresh {@link Point} of per-axis fractions
   * (`0`–`1`). See {@link TextOptions.anchor} for the meaning. Returned by
   * value; mutating the result does not affect the text — use
   * {@link Text.setAnchor}.
   */
  public get anchor(): Point {
    return new Point(this.raw.anchor.x, this.raw.anchor.y);
  }

  /**
   * Sets the anchor point — the spot on the rendered text that sits on the
   * host's position — as a fraction of the bounding box.
   *
   * @param x The horizontal anchor fraction (`0` left, `1` right).
   * @param y The vertical anchor fraction (`0` top, `1` bottom). Defaults
   * to `x`, so `setAnchor(0.5)` centres on both axes.
   */
  public setAnchor(x: number, y: number = x): void {
    this.raw.anchor.set(x, y);
  }

  /**
   * Width of the rendered text in pixels, as the renderer measures it
   * given the current string, font family, and size. Useful for laying
   * out HUD elements relative to the text's actual extent.
   */
  public get width(): number {
    return this.raw.width;
  }

  /**
   * Height of the rendered text in pixels, as the renderer measures it
   * given the current string, font family, and size.
   */
  public get height(): number {
    return this.raw.height;
  }
}
