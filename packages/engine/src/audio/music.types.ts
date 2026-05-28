/**
 * Construction-time configuration for the {@link Music} world component.
 *
 * Every field is optional with a sensible default. Defaults reflect what a
 * "background track" usually wants: `volume: 1`, `pan: 0`, `loop: true`,
 * `autoplay: false`.
 */
export type MusicOptions = {
  /**
   * Initial volume from `0` to `1`. Defaults to `1`.
   */
  readonly volume?: number;

  /**
   * Initial stereo pan from `-1` to `1`. Defaults to `0`.
   */
  readonly pan?: number;

  /**
   * Whether playback loops back to the start when it reaches the end.
   * Defaults to `true` — background music almost always loops.
   */
  readonly loop?: boolean;

  /**
   * Whether the track starts playing immediately when the component is
   * attached. Defaults to `false`, leaving the decision to game code so a
   * paused-on-startup splash or a "press to start" intro can attach the
   * music early and start it on the user gesture. Set to `true` for the
   * common "music plays as soon as the world boots" pattern.
   */
  readonly autoplay?: boolean;
};
