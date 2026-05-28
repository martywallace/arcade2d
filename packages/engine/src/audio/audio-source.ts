import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { AbstractWorldObjectComponent } from '../world/abstract-world-object-component';
import type { WorldObject } from '../world/world-object';
import { AudioCategory } from './audio.constants';
import type { AudioAsset } from './audio-asset';
import type { AudioInstance } from './audio-instance';
import type {
  AudioSourceOptions,
  AudioSourcePlayOptions,
} from './audio-source.types';

/**
 * Plays short, one-shot sound effects from a {@link WorldObject}.
 *
 * Attach an `AudioSource` to any object that needs to emit SFX — a player
 * who fires bullets, a door that creaks, a wall that takes damage. Each
 * call to {@link AudioSource.play} spawns a fresh, fire-and-forget
 * {@link AudioInstance} routed through the {@link AudioEngine}'s SFX bus,
 * so several voices from the same source can overlap freely (the burst of
 * an automatic weapon, two shots in quick succession).
 *
 * ## What "source" means
 *
 * `AudioSource` is the host-component analogue of the renderer's
 * {@link Sprite}: a thin behavioural component bound to a {@link WorldObject}
 * that exposes a tidy `play()` / `stop()` surface and hides the audio-graph
 * bookkeeping. The component holds:
 *
 * - A **default asset** — the clip most calls play, often the only one.
 * - **Default volume and pan** — applied to each voice unless the call
 *   site overrides them in {@link AudioSourcePlayOptions}.
 * - The set of voices it has spawned but not yet finished, so it can
 *   {@link AudioSource.stop} them in bulk or clean them up when the host
 *   {@link WorldObject} is destroyed.
 *
 * ## Spawn vs play
 *
 * Unlike {@link Music}, voices are spawned per-play, not held by the
 * component. {@link AudioSource.play} returns the spawned
 * {@link AudioInstance} for the rare caller that wants to fade or stop
 * one voice specifically; most callers ignore the return value entirely.
 *
 * ## Stereo positioning
 *
 * `AudioSource` does not auto-position based on the host's world position
 * — the engine's panning is a manual `[-1, 1]` knob, not a positional
 * `PannerNode` model. If you want a sound to follow the host, set
 * {@link AudioSource.pan} from your own controller (e.g. interpolate from
 * `host.position.x` against the camera). A positional/`PannerNode`-based
 * variant may land later.
 *
 * @example
 * ```ts
 * const player = world.createObject();
 * const shoot = game.assets.getAs('gunshot', AudioAsset);
 *
 * player.addComponentFromFactory(
 *   'audio',
 *   (host) => new AudioSource(host, shoot, { volume: 0.6 }),
 * );
 *
 * // Later, in the input handler:
 * player.getComponent<AudioSource>('audio').play();
 * ```
 *
 * @see {@link AudioInstance} for the per-voice playback handle.
 * @see {@link AudioEngine} for the bus this source routes through.
 * @see {@link Music} for the world-tier music counterpart.
 */
export class AudioSource extends AbstractWorldObjectComponent {
  private _asset: AudioAsset | null;
  private _volume: number;
  private _pan: number;
  private readonly _voices = new Set<AudioInstance>();

  /**
   * @param host The {@link WorldObject} this source is attached to.
   * @param asset The default clip this source plays. Pass `null` (or omit
   * via {@link AudioSourcePlayOptions.asset}) to play a per-call clip
   * without a default — useful for sources that always specify the clip at
   * call time.
   * @param options Optional {@link AudioSourceOptions} (default volume and
   * pan).
   */
  constructor(
    host: WorldObject,
    asset: AudioAsset | null = null,
    options: AudioSourceOptions = {},
  ) {
    super(host);
    this._asset = asset;
    this._volume = options.volume ?? 1;
    this._pan = options.pan ?? 0;
  }

  /**
   * The default {@link AudioAsset} this source plays, or `null` when the
   * source was constructed without one.
   */
  public get asset(): AudioAsset | null {
    return this._asset;
  }

  /**
   * Swap the default {@link AudioAsset}. Does not affect voices already
   * playing — they keep playing the asset they were started with.
   *
   * @param asset The new default asset, or `null` to clear it.
   */
  public setAsset(asset: AudioAsset | null): void {
    this._asset = asset;
  }

  /**
   * Default volume from `0` to `1` applied to each new voice. Setting this
   * also re-targets any currently-playing voices spawned by this source —
   * a single source pretends to be one continuous emitter even when it is
   * actually a bag of one-shots.
   */
  public get volume(): number {
    return this._volume;
  }

  public set volume(value: number) {
    this._volume = value;
    for (const voice of this._voices) {
      voice.volume = value;
    }
  }

  /**
   * Default stereo pan from `-1` (left) to `1` (right) applied to each new
   * voice. Setting this also re-targets currently-playing voices.
   */
  public get pan(): number {
    return this._pan;
  }

  public set pan(value: number) {
    this._pan = value;
    for (const voice of this._voices) {
      voice.pan = value;
    }
  }

  /**
   * Spawns a fresh playback voice and starts it. Each call produces an
   * independent {@link AudioInstance}, so overlapping plays (rapid fire,
   * footstep cadence, a triggered burst) layer naturally instead of
   * cutting each other off.
   *
   * The voice is registered internally so {@link AudioSource.stop} and
   * `onDestroy` can shut it down in bulk, and unregistered automatically
   * when the underlying source ends.
   *
   * @param options Optional {@link AudioSourcePlayOptions} overriding the
   * source's defaults for this one voice only.
   * @returns The spawned {@link AudioInstance}. Most callers ignore the
   * return; reach for it when you want to fade or stop a specific voice.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.AUDIO_NO_SOURCE} when no asset is supplied and the
   *   source has no default asset to fall back on.
   */
  public play(options: AudioSourcePlayOptions = {}): AudioInstance {
    const asset = options.asset ?? this._asset;
    if (!asset) {
      throwEngineError(
        ErrorCode.AUDIO_NO_SOURCE,
        'AudioSource.play called with no asset and no default asset. Pass ' +
          'one via play({ asset }) or set a default in the constructor / ' +
          'AudioSource.setAsset.',
        { host: this.host },
      );
    }

    const engine = this.game.audio;
    const voice = engine.createInstance(asset.raw, AudioCategory.Sfx, {
      volume: options.volume ?? this._volume,
      pan: options.pan ?? this._pan,
      loop: options.loop ?? false,
    });

    this._voices.add(voice);
    voice.onEnded(() => {
      this._voices.delete(voice);
      voice.destroy();
    });

    voice.play();
    return voice;
  }

  /**
   * Stops every voice this source is currently playing and tears each one
   * down. Idempotent — calling on a source with no active voices is a
   * no-op.
   */
  public stop(): void {
    for (const voice of this._voices) {
      voice.destroy();
    }
    this._voices.clear();
  }

  /**
   * The number of voices this source currently has running. Useful for
   * tests and for caps ("don't spawn more than four concurrent footsteps").
   */
  public get activeVoiceCount(): number {
    return this._voices.size;
  }

  /**
   * Stops every active voice and releases the source's audio graph
   * resources when the host {@link WorldObject} is destroyed.
   */
  public override onDestroy(): void {
    this.stop();
  }
}
