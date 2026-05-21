import type { PointPrimitive } from '../geometry';

/**
 * Construction-time configuration for a {@link Sprite}. Every field is
 * optional; an omitted field takes the documented default.
 */
export type SpriteOptions = {
  /**
   * The anchor point — the spot on the texture that sits on the host
   * {@link WorldObject}'s position — as a fraction of the texture's size in
   * each axis. `0` is the left/top edge, `1` the right/bottom, `0.5` the
   * centre. Pass a single number to use it for both axes, or a
   * {@link PointPrimitive} for independent values.
   *
   * Defaults to `0.5` (centred), which differs from the renderer's own
   * top-left default. Centring matches arcade2d's convention that a
   * {@link WorldObject}'s position is its origin — the same reason
   * {@link PolygonGraphics.asRectangle} centres its rectangle on `(0, 0)`.
   */
  readonly anchor?: number | PointPrimitive;

  /**
   * Multiplicative tint as a 24-bit RGB integer (e.g. `0xff0000` for red).
   * `0xffffff` (white) leaves colours unchanged. Defaults to `0xffffff`.
   */
  readonly tint?: number;

  /**
   * Opacity in the range `0` (fully transparent) to `1` (fully opaque).
   * Defaults to `1`.
   */
  readonly alpha?: number;

  /**
   * Whether the sprite is drawn at all. A hidden sprite still ticks and
   * keeps its transform in sync; it is simply skipped by the renderer.
   * Defaults to `true`.
   */
  readonly visible?: boolean;
};
