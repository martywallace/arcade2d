import { AbstractWorldComponent } from '../world/abstract-world-component';
import type { World } from '../world/world';
import { AudioCategory } from './audio.constants';
import type { AudioAsset } from './audio-asset';
import type { AudioInstance } from './audio-instance';
import type { MusicOptions } from './music.types';

/**
 * Plays a single, long-lived audio track at the world tier — the
 * background music for a level, menu, or boss fight.
 *
 * `Music` is a world-scoped component (one playing track per world is the
 * canonical model) that owns exactly one {@link AudioInstance} routed
 * through the {@link AudioEngine}'s music bus. The component proxies the
 * standard playback surface — {@link Music.play}, {@link Music.pause},
 * {@link Music.stop}, {@link Music.restart}, volume, pan, loop — directly
 * to that instance, so game code talks to a single component without
 * caring that an `AudioInstance` is doing the work underneath.
 *
 * ## When to reach for it vs. AudioSource
 *
 * Use `Music` for *one* long-running track per world. Use
 * {@link AudioSource} for short one-shot SFX attached to world objects.
 * The difference is the lifecycle:
 *
 * - A `Music` instance is created once and reused — `pause` and `play`
 *   resume from the same position, `stop` rewinds.
 * - An `AudioSource` spawns a fresh voice per `play()` so several copies
 *   of the same SFX can overlap.
 *
 * ## Autoplay and the user-gesture rule
 *
 * Browsers suspend a freshly-created `AudioContext` until a user gesture
 * unlocks it. Setting `autoplay: true` on a `Music` component that is
 * attached before any user input will *call* `play()` immediately, but
 * the underlying context may still be suspended — audio starts inaudibly
 * and becomes audible the moment the player clicks, taps, or presses a
 * key. Use {@link AudioEngine.resume} from a click handler if you want
 * deterministic start-on-gesture.
 *
 * @example
 * ```ts
 * const theme = game.assets.getAs('theme', AudioAsset);
 *
 * const world = game.createWorld({
 *   components: (w) => ({
 *     music: () => new Music(w, theme, { volume: 0.5, autoplay: true }),
 *   }),
 * });
 *
 * // Later, in a pause handler:
 * world.getComponent<Music>('music').pause();
 * ```
 *
 * @see {@link AudioInstance} for the playback handle this component wraps.
 * @see {@link AudioSource} for the world-object SFX counterpart.
 */
export class Music extends AbstractWorldComponent {
  private readonly _instance: AudioInstance;

  /**
   * @param host The {@link World} this music component is attached to.
   * @param asset The audio clip to play.
   * @param options Optional {@link MusicOptions} (volume, pan, loop,
   * autoplay).
   */
  constructor(host: World, asset: AudioAsset, options: MusicOptions = {}) {
    super(host);

    const engine = host.game.audio;
    this._instance = engine.createInstance(asset.raw, AudioCategory.Music, {
      volume: options.volume ?? 1,
      pan: options.pan ?? 0,
      loop: options.loop ?? true,
    });

    if (options.autoplay ?? false) {
      this._instance.play();
    }
  }

  /**
   * Direct access to the underlying {@link AudioInstance}. Use this for
   * advanced playback control (subscribing to {@link AudioInstance.onEnded}
   * for a non-looping track, hooking into the buffer for visualisations,
   * etc.). The proxy methods on this class cover the common operations.
   */
  public get instance(): AudioInstance {
    return this._instance;
  }

  /**
   * Track duration in seconds.
   */
  public get duration(): number {
    return this._instance.duration;
  }

  /**
   * Whether the track is currently playing.
   */
  public get playing(): boolean {
    return this._instance.playing;
  }

  /**
   * Whether the track is currently paused. The next {@link Music.play}
   * resumes from the same position.
   */
  public get paused(): boolean {
    return this._instance.paused;
  }

  /**
   * Whether the track is currently stopped (rewound). The next
   * {@link Music.play} starts from the beginning.
   */
  public get stopped(): boolean {
    return this._instance.stopped;
  }

  /**
   * Volume from `0` to `1`. Multiplied with the engine's music-bus and
   * master gains at playback time.
   */
  public get volume(): number {
    return this._instance.volume;
  }

  public set volume(value: number) {
    this._instance.volume = value;
  }

  /**
   * Stereo pan from `-1` (left) to `1` (right).
   */
  public get pan(): number {
    return this._instance.pan;
  }

  public set pan(value: number) {
    this._instance.pan = value;
  }

  /**
   * Whether the track loops at its end. Defaults to `true` on construction.
   */
  public get loop(): boolean {
    return this._instance.loop;
  }

  public set loop(value: boolean) {
    this._instance.loop = value;
  }

  /**
   * Starts playback from the current resume position — zero on a fresh
   * component, the pause offset after {@link Music.pause}. Calling on an
   * already-playing instance is a no-op.
   */
  public play(): void {
    this._instance.play();
  }

  /**
   * Pauses playback in place. The next {@link Music.play} resumes from
   * here. Idempotent.
   */
  public pause(): void {
    this._instance.pause();
  }

  /**
   * Stops playback and rewinds to the start. The next {@link Music.play}
   * starts from the beginning of the track.
   */
  public stop(): void {
    this._instance.stop();
  }

  /**
   * Stops the track if it is running, rewinds to the start, then plays.
   * Equivalent to {@link Music.stop} followed by {@link Music.play}.
   */
  public restart(): void {
    this._instance.restart();
  }

  /**
   * Tears down the underlying {@link AudioInstance} when the world is
   * destroyed.
   */
  public override onDestroy(): void {
    this._instance.destroy();
  }
}
