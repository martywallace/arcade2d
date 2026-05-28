/**
 * Per-instance options passed to {@link AudioEngine.createInstance} (and
 * indirectly to {@link AudioSource.play} / {@link Music}).
 *
 * Every field is optional with a sensible default.
 */
export type AudioInstanceOptions = {
  /**
   * Initial per-instance volume from `0` (silent) to `1` (unattenuated).
   * Defaults to `1`. Multiplied with the routed category gain and the master
   * gain at playback time, so the audible level is `volume * category *
   * master`.
   */
  readonly volume?: number;

  /**
   * Initial stereo pan from `-1` (full left) to `1` (full right). Defaults
   * to `0` (centred). Implemented with a `StereoPannerNode`, which performs
   * an equal-power pan curve on stereo and mono input alike.
   */
  readonly pan?: number;

  /**
   * Whether the clip loops back to its start when it reaches the end.
   * Defaults to `false`. Looping is the usual default for background music
   * and the wrong default for one-shot SFX, so callers opt in.
   */
  readonly loop?: boolean;
};
