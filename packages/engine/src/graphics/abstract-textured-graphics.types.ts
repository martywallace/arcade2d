import type { PointPrimitive } from '../geometry';
import type { GraphicsOptions } from './abstract-graphics.types';

/**
 * The visual options shared by every *textured* graphics component —
 * {@link Sprite}, {@link AnimatedSprite}, {@link TilingSprite}, and
 * {@link Text}. Extends the base {@link GraphicsOptions} (`alpha`, `visible`)
 * with the two properties a textured display object adds: an `anchor` and a
 * `tint`. Each component's own options type extends this with its specifics.
 */
export interface TexturedGraphicsOptions extends GraphicsOptions {
  /**
   * The anchor point — the spot on the graphic that sits on the host
   * {@link WorldObject}'s position — as a fraction of the graphic's size in
   * each axis. `0` is the left/top edge, `1` the right/bottom, `0.5` the
   * centre. Pass a single number to use it for both axes, or a
   * {@link PointPrimitive} for independent values.
   *
   * Defaults to `0.5` (centred), which differs from the renderer's own
   * top-left default. Centring matches arcade2d's convention that a
   * {@link WorldObject}'s position is its visual origin.
   */
  readonly anchor?: number | PointPrimitive;

  /**
   * Multiplicative tint as a 24-bit RGB integer (e.g. `0xff0000` for red).
   * `0xffffff` (white) leaves colours unchanged. For {@link Text} this
   * multiplies on top of the glyph {@link TextOptions.fill}. Defaults to
   * `0xffffff`.
   */
  readonly tint?: number;
}
