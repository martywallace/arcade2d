import type { PointPrimitive } from '../geometry';

/**
 * Construction-time configuration for an {@link AnimatedSprite}. Every field
 * is optional; an omitted field takes the documented default.
 */
export type AnimatedSpriteOptions = {
  /**
   * Playback rate in frames per second. The per-frame duration is `1000 /
   * fps` milliseconds. Defaults to `12`. Must be greater than `0`.
   */
  readonly fps?: number;

  /**
   * Whether playback wraps from the last frame back to the first. When
   * `false`, the animation holds on the final frame and stops (firing
   * {@link AnimatedSpriteOptions.onComplete}). Defaults to `true`.
   */
  readonly loop?: boolean;

  /**
   * Whether the animation starts playing immediately on construction. When
   * `false`, the sprite shows its first frame and waits for
   * {@link AnimatedSprite.play}. Defaults to `true`.
   */
  readonly autoplay?: boolean;

  /**
   * Invoked once when a non-looping animation reaches and holds its final
   * frame. Never fires while {@link AnimatedSpriteOptions.loop} is `true`.
   */
  readonly onComplete?: () => void;

  /**
   * The anchor point — the spot on each frame that sits on the host
   * {@link WorldObject}'s position — as a fraction of the frame's size in
   * each axis. `0` is the left/top edge, `1` the right/bottom, `0.5` the
   * centre. Pass a single number to use it for both axes, or a
   * {@link PointPrimitive} for independent values. Defaults to `0.5`
   * (centred), matching {@link Sprite}.
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
   * Whether the sprite is drawn at all. A hidden sprite still advances its
   * animation and keeps its transform in sync; it is simply skipped by the
   * renderer. Defaults to `true`.
   */
  readonly visible?: boolean;
};
