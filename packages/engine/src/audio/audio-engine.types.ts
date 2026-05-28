/**
 * Bootstrap configuration for the {@link AudioEngine}, threaded through
 * {@link GameOptions.audio}.
 *
 * Every field is optional with a sensible default. The engine works with no
 * options at all — pass an `audio` block only to set initial bus levels or
 * disable audio entirely.
 */
export type AudioEngineOptions = {
  /**
   * Initial master volume from `0` to `1`. Defaults to `1`. The master gain
   * sits at the bottom of the audio graph; every category bus and every
   * instance routes through it, so this is the single knob that mutes the
   * whole game.
   */
  readonly masterVolume?: number;

  /**
   * Initial music-bus volume from `0` to `1`. Defaults to `1`. Multiplied
   * with the master gain at playback time; the audible level for a music
   * instance is `instance * music * master`.
   */
  readonly musicVolume?: number;

  /**
   * Initial sfx-bus volume from `0` to `1`. Defaults to `1`. Multiplied
   * with the master gain at playback time; the audible level for an sfx
   * instance is `instance * sfx * master`.
   */
  readonly sfxVolume?: number;

  /**
   * Force the engine into headless mode regardless of whether a Web Audio
   * `AudioContext` is available. Defaults to `false`. Use this in tests or
   * in environments where you want every playback call to be an inert
   * no-op even though the runtime would technically support audio.
   */
  readonly disabled?: boolean;
};
