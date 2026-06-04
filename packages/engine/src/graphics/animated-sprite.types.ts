import type { TexturedGraphicsOptions } from './abstract-textured-graphics.types';

/**
 * Construction-time configuration for an {@link AnimatedSprite}. Extends the
 * shared {@link TexturedGraphicsOptions} (`anchor`, `tint`, `alpha`,
 * `visible`) with the playback controls. Every field is optional; an omitted
 * field takes the documented default.
 */
export interface AnimatedSpriteOptions extends TexturedGraphicsOptions {
  /**
   * Playback rate in frames per second. The per-frame duration is `1000 /
   * fps` milliseconds. Defaults to `12`. Must be a positive, finite number —
   * a zero, negative, or non-finite rate throws
   * {@link ErrorCode.ANIMATED_SPRITE_INVALID_FPS}.
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
}
