import { Asset } from '../assets/asset';
import { AssetType } from '../assets/asset.constants';

/**
 * An {@link Asset} wrapping a decoded audio clip as a Web Audio
 * `AudioBuffer`.
 *
 * `AudioAsset` is what {@link AssetLibrary.load} produces for any path that
 * resolves to {@link AssetType.Audio} — MP3, Ogg Vorbis, WAV, M4A/AAC, FLAC,
 * WebM/Opus. It is the handoff between the asset layer and the audio
 * playback layer: the audio-playing components ({@link AudioSource},
 * {@link Music}) take an `AudioAsset` and pull the decoded buffer from it
 * internally, so game code references sounds by key and never touches an
 * `AudioBuffer` itself.
 *
 * The browser `AudioBuffer` is deliberately *not* part of arcade2d's stable
 * surface — it is reachable only through {@link AudioAsset.raw}, the escape
 * hatch. The duration a sequencing-minded caller actually needs is surfaced
 * as a plain number via {@link AudioAsset.duration}.
 *
 * ## Decoding cost
 *
 * Decoding happens during {@link AssetLibrary.load} — the moment the load
 * promise resolves, the clip is decoded, in memory, and ready to play with
 * no audible latency at the first play. This is what makes audio behave like
 * any other arcade2d asset: preload it eagerly at a coarse boundary, then
 * play it any number of times for free.
 *
 * @example
 * ```ts
 * await game.assets.load('sfx/explosion.wav', { key: 'explosion' });
 * const explosion = game.assets.getAs('explosion', AudioAsset);
 * console.log(explosion.duration);
 * ```
 *
 * @see {@link AssetLibrary} for how audio clips are loaded and retrieved.
 * @see {@link AudioSource} for the world-object component that plays SFX.
 * @see {@link Music} for the world-tier component that plays music.
 */
export class AudioAsset extends Asset {
  public readonly type = AssetType.Audio;

  /**
   * @param key See {@link Asset}. The name this clip is stored under.
   * @param namespace See {@link Asset}. The group this clip belongs to.
   * @param src See {@link Asset}. The resolved path the clip loaded from.
   * @param _buffer The decoded Web Audio buffer, held privately. Exposed
   * only via {@link AudioAsset.raw}; the public surface speaks in arcade2d
   * terms.
   */
  constructor(
    key: string,
    namespace: string,
    src: string,
    private readonly _buffer: AudioBuffer,
  ) {
    super(key, namespace, src);
  }

  /**
   * Direct access to the underlying Web Audio `AudioBuffer` instance.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — feeding the buffer into a custom audio
   * graph, sampling its PCM data, anything we haven't decided how to model
   * yet. Code that touches `raw` is coupled to the Web Audio API and may
   * break when arcade2d swaps the audio backend.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed accessors on this class; reach for `raw` only
   * when no equivalent exists, and isolate the access behind your own helper
   * so the coupling is in one place.
   */
  public get raw(): AudioBuffer {
    return this._buffer;
  }

  /**
   * Duration of the clip in seconds, as reported by the underlying buffer.
   */
  public get duration(): number {
    return this._buffer.duration;
  }

  /**
   * The number of audio channels in the underlying buffer (`1` for mono,
   * `2` for stereo).
   */
  public get channelCount(): number {
    return this._buffer.numberOfChannels;
  }

  /**
   * Sample rate of the underlying buffer in Hz.
   */
  public get sampleRate(): number {
    return this._buffer.sampleRate;
  }
}
