/**
 * Reserved component key the engine uses to register the {@link AudioEngine}
 * on every {@link Game}. Exposed as a constant so callers that need to
 * introspect or replace the audio backend (e.g. swapping in a recorded or
 * fixture-backed variant for testing) don't have to hard-code a magic string.
 */
export const AUDIO_ENGINE_COMPONENT_KEY = 'audio';

/**
 * Routing categories an {@link AudioInstance} (and the components that own
 * one) connects through inside the {@link AudioEngine}.
 *
 * The engine maintains one {@link GainNode} per category, so adjusting
 * {@link AudioEngine.musicVolume} or {@link AudioEngine.sfxVolume} affects
 * every instance routed through that category at once. Category routing is
 * also the seam a future audio-options menu hooks into to give players
 * separate music/sfx volume sliders.
 */
export enum AudioCategory {
  /**
   * Long-lived, typically looping playback — the background music a
   * {@link Music} component drives. Routed through the engine's music gain
   * node.
   */
  Music = 'music',

  /**
   * Short, transient playback — UI clicks, weapon fire, footsteps, explosions
   * — emitted by an {@link AudioSource} component. Routed through the
   * engine's sfx gain node.
   */
  Sfx = 'sfx',
}
