import { Container, ObservablePoint } from 'pixi.js';
import { Point } from '../geometry';
import type { PointPrimitive } from '../geometry';
import { WorldObject } from '../world';
import { AbstractGraphics } from './abstract-graphics';
import type { TexturedGraphicsOptions } from './abstract-textured-graphics.types';

/**
 * The Pixi display objects {@link AbstractTexturedGraphics} can wrap: a
 * {@link Container} (which already carries `tint`) that also exposes an
 * `anchor`. Pixi's `Sprite`, `TilingSprite`, and `Text` all satisfy it.
 */
interface TexturedDisplay extends Container {
  anchor: ObservablePoint;
}

/**
 * Base class for the graphics components that wrap a *textured* Pixi display
 * object — {@link Sprite}, {@link AnimatedSprite}, {@link TilingSprite}, and
 * {@link Text}. It sits between {@link AbstractGraphics} (which owns
 * scene-parenting, the per-frame transform sync, and `alpha`/`visible`) and
 * the concrete components, and adds the two properties every textured display
 * object shares:
 *
 * - **`anchor`** — the fractional point on the graphic that lands on the
 *   host's position (read via {@link AbstractTexturedGraphics.anchor},
 *   changed via {@link AbstractTexturedGraphics.setAnchor}).
 * - **`tint`** — a multiplicative colour applied to the whole graphic.
 *
 * Its constructor applies the full {@link TexturedGraphicsOptions} bag
 * (`anchor`, `tint`, plus the inherited `alpha`/`visible`), so subclasses just
 * build their display object and hand it up — they don't repeat the
 * option-unpacking themselves.
 *
 * @template T The concrete textured Pixi display object this component wraps.
 *
 * @see {@link AbstractGraphics} for the shared lifecycle and transform sync.
 */
export abstract class AbstractTexturedGraphics<
  T extends TexturedDisplay,
> extends AbstractGraphics<T> {
  /**
   * @param host The {@link WorldObject} this component is attached to.
   * @param display The textured Pixi display object, constructed by the
   * subclass.
   * @param options The {@link TexturedGraphicsOptions} — `anchor`, `tint`,
   * `alpha`, and `visible`, applied here so subclasses don't repeat the
   * unpacking. Subclasses default it for their own callers.
   */
  constructor(host: WorldObject, display: T, options: TexturedGraphicsOptions) {
    super(host, display, options);

    AbstractTexturedGraphics._applyAnchor(display, options.anchor ?? 0.5);
    display.tint = options.tint ?? 0xffffff;
  }

  /**
   * The anchor point as a fresh {@link Point} of per-axis fractions (`0`–`1`).
   * See {@link TexturedGraphicsOptions.anchor} for the meaning. Returned by
   * value; mutating the result does not affect the graphic — use
   * {@link AbstractTexturedGraphics.setAnchor}.
   */
  public get anchor(): Point {
    return new Point(this.raw.anchor.x, this.raw.anchor.y);
  }

  /**
   * Sets the anchor point — the spot on the graphic that sits on the host's
   * position — as a fraction of the graphic's size.
   *
   * @param x The horizontal anchor fraction (`0` left, `1` right).
   * @param y The vertical anchor fraction (`0` top, `1` bottom). Defaults to
   * `x`, so `setAnchor(0.5)` centres on both axes.
   */
  public setAnchor(x: number, y: number = x): void {
    this.raw.anchor.set(x, y);
  }

  /**
   * Multiplicative tint as a 24-bit RGB integer; `0xffffff` is untinted. See
   * {@link TexturedGraphicsOptions.tint}.
   */
  public get tint(): number {
    return this.raw.tint;
  }

  public set tint(value: number) {
    this.raw.tint = value;
  }

  // Normalises the anchor option (a single fraction or a per-axis primitive)
  // onto the display. Static so it can run before the subclass touches `this`.
  private static _applyAnchor(
    display: TexturedDisplay,
    anchor: number | PointPrimitive,
  ): void {
    if (typeof anchor === 'number') {
      display.anchor.set(anchor, anchor);
    } else {
      display.anchor.set(anchor.x, anchor.y);
    }
  }
}
