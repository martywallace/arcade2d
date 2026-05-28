import type { AudioAsset } from './audio-asset';

/**
 * Construction-time configuration for {@link AudioSource}. Every field is
 * optional with a sensible default.
 */
export type AudioSourceOptions = {
  /**
   * Default volume from `0` to `1` applied to each voice the source plays
   * unless overridden in {@link AudioSourcePlayOptions.volume}. Defaults to
   * `1`.
   */
  readonly volume?: number;

  /**
   * Default stereo pan from `-1` to `1` applied to each voice the source
   * plays unless overridden in {@link AudioSourcePlayOptions.pan}. Defaults
   * to `0`.
   */
  readonly pan?: number;
};

/**
 * Per-call configuration for {@link AudioSource.play}. Every field is
 * optional and overrides the source's defaults for this one voice only —
 * the source's stored volume/pan are untouched.
 */
export type AudioSourcePlayOptions = {
  /**
   * Override the source's default volume for this voice only.
   */
  readonly volume?: number;

  /**
   * Override the source's default pan for this voice only.
   */
  readonly pan?: number;

  /**
   * Override the source's default loop flag for this voice only. Usually
   * left at `false`: looping SFX from an {@link AudioSource} is a niche
   * use; for a long-running looped clip reach for {@link Music} instead.
   */
  readonly loop?: boolean;

  /**
   * Override the source's default {@link AudioAsset} for this voice only —
   * useful when one source plays one of several alternate clips (the
   * "footstep" pattern with three or four interchangeable variations).
   */
  readonly asset?: AudioAsset;
};
