import { AbstractGameComponent } from '../abstract-game-component';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { AudioCategory } from './audio.constants';
import type { AudioEngineOptions } from './audio-engine.types';
import { AudioInstance } from './audio-instance';
import type { AudioInstanceOptions } from './audio-instance.types';

/**
 * Browser globals that may or may not exist depending on the runtime.
 * Typed as `unknown` to keep the engine free of `lib.dom` assumptions at
 * the top level; the constructor narrows them with `typeof === 'function'`.
 *
 * @internal
 */
type AudioContextConstructor = new () => AudioContext;

/**
 * Game-tier root of the audio graph: owns the Web Audio `AudioContext`, the
 * master and per-category gain buses, and the seam used by
 * {@link AssetLibrary} to decode {@link AudioAsset}s and by the audio
 * components ({@link AudioSource}, {@link Music}) to construct playback
 * voices.
 *
 * `AudioEngine` is auto-attached to every {@link Game} and reached through
 * {@link Game.audio}. It lives at the game tier, not the world tier, because
 * the audio context outlives any individual world: ramping a volume slider
 * in the pause menu, or letting a music track continue across a world
 * transition, both depend on a single long-lived context.
 *
 * ## Graph layout
 *
 * ```
 *      [BufferSource] → [Gain] → [Panner] ─┐                  ┌─→ master ─→ destination
 *                                          ├─→ music gain ────┤
 *      [BufferSource] → [Gain] → [Panner] ─┘                  │
 *      [BufferSource] → [Gain] → [Panner] ─┐                  │
 *                                          ├─→ sfx gain ──────┘
 *      [BufferSource] → [Gain] → [Panner] ─┘
 * ```
 *
 * Per-instance gain and panner nodes are managed by {@link AudioInstance};
 * this class owns the three category buses and the connection from each bus
 * up to `context.destination`. Adjusting {@link AudioEngine.masterVolume},
 * {@link AudioEngine.musicVolume}, or {@link AudioEngine.sfxVolume} ramps
 * the corresponding `GainNode` instantly and affects every instance routed
 * through it.
 *
 * ## Headless mode
 *
 * If the runtime has no `AudioContext` constructor — node, jsdom, an
 * `audio: { disabled: true }` opt-out — the engine enters *headless mode*.
 * In headless mode, {@link AudioEngine.available} returns `false`, the gain
 * nodes are `null`, and every {@link AudioInstance} this engine produces is
 * an inert no-op. This is the same model the {@link Mouse} and
 * {@link Keyboard} samplers use to keep tests and SSR builds compiling and
 * running without the page-scoped browser globals their production paths
 * need.
 *
 * ## Autoplay policy
 *
 * Browsers suspend a freshly-created `AudioContext` until the page has
 * received a user gesture. {@link AudioEngine.resume} is a thin wrapper
 * over `context.resume()` for callers that want to hook the first click /
 * key press explicitly; the engine does not silently resume the context on
 * its own, because doing so on every `play()` would mask legitimate
 * suspension cases (a user-paused tab).
 *
 * @see {@link AudioInstance} for the playback handle.
 * @see {@link AudioSource} for the world-object component that plays SFX.
 * @see {@link Music} for the world-tier component that plays music.
 */
export class AudioEngine extends AbstractGameComponent {
  private readonly _context: AudioContext | null;
  private readonly _masterGain: GainNode | null;
  private readonly _musicGain: GainNode | null;
  private readonly _sfxGain: GainNode | null;

  /**
   * @param host The {@link Game} this engine is attached to.
   * @param options Optional {@link AudioEngineOptions} controlling initial
   * bus levels and whether to force headless mode.
   */
  constructor(host: import('../game').Game, options: AudioEngineOptions = {}) {
    super(host);

    const Ctor = options.disabled ? undefined : resolveAudioContextCtor();

    if (Ctor) {
      const ctx = new Ctor();

      const masterGain = ctx.createGain();
      masterGain.gain.value = options.masterVolume ?? 1;
      masterGain.connect(ctx.destination);

      const musicGain = ctx.createGain();
      musicGain.gain.value = options.musicVolume ?? 1;
      musicGain.connect(masterGain);

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = options.sfxVolume ?? 1;
      sfxGain.connect(masterGain);

      this._context = ctx;
      this._masterGain = masterGain;
      this._musicGain = musicGain;
      this._sfxGain = sfxGain;
    } else {
      this._context = null;
      this._masterGain = null;
      this._musicGain = null;
      this._sfxGain = null;
    }
  }

  /**
   * Direct access to the underlying Web Audio `AudioContext`, or `null` in
   * headless mode.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — custom nodes (filters, reverbs,
   * analysers), advanced scheduling against `context.currentTime`, anything
   * we haven't decided how to model yet. Code that touches `raw` is coupled
   * to the Web Audio API and may break when arcade2d swaps the audio
   * backend.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed methods on this component; reach for `raw`
   * only when no equivalent exists, and isolate the access behind your own
   * helper so the coupling is in one place.
   */
  public get raw(): AudioContext | null {
    return this._context;
  }

  /**
   * Whether audio is actually available in this runtime — `true` when a
   * Web Audio context exists, `false` in headless mode. Branch on this if
   * you want to skip work (e.g. don't even load audio assets) when the
   * environment can't play them anyway.
   */
  public get available(): boolean {
    return this._context !== null;
  }

  /**
   * Master volume from `0` to `1`. The single knob at the bottom of the
   * audio graph; every category bus and every instance routes through it.
   * Setting this in headless mode silently retains the value but has no
   * audible effect.
   */
  public get masterVolume(): number {
    return this._masterGain?.gain.value ?? 0;
  }

  public set masterVolume(value: number) {
    if (this._masterGain) {
      this._masterGain.gain.value = value;
    }
  }

  /**
   * Music-bus volume from `0` to `1`. Multiplied with the master gain at
   * playback time; affects every {@link Music} instance and any other
   * playback routed through {@link AudioCategory.Music}.
   */
  public get musicVolume(): number {
    return this._musicGain?.gain.value ?? 0;
  }

  public set musicVolume(value: number) {
    if (this._musicGain) {
      this._musicGain.gain.value = value;
    }
  }

  /**
   * SFX-bus volume from `0` to `1`. Multiplied with the master gain at
   * playback time; affects every {@link AudioSource} voice and any other
   * playback routed through {@link AudioCategory.Sfx}.
   */
  public get sfxVolume(): number {
    return this._sfxGain?.gain.value ?? 0;
  }

  public set sfxVolume(value: number) {
    if (this._sfxGain) {
      this._sfxGain.gain.value = value;
    }
  }

  /**
   * Resumes the underlying `AudioContext` if browser autoplay policy
   * suspended it. Returns a promise that resolves once the context is
   * running (or immediately if it never needed resuming, or if the engine
   * is headless).
   *
   * Most games hook this to their first user input — a "Click to start"
   * splash, the first key press, the pause-menu close button. Doing it on
   * every `play()` is wasteful and masks legitimate suspension states.
   */
  public async resume(): Promise<void> {
    const ctx = this._context;
    if (!ctx || ctx.state !== 'suspended') {
      return;
    }
    await ctx.resume();
  }

  /**
   * Suspends the underlying `AudioContext`. Use this when the game loses
   * focus or the player pauses — every running source freezes in place and
   * resumes audibly seamless on the next {@link AudioEngine.resume}.
   * No-op in headless mode.
   */
  public async suspend(): Promise<void> {
    const ctx = this._context;
    if (!ctx || ctx.state === 'suspended') {
      return;
    }
    await ctx.suspend();
  }

  /**
   * Decodes an `ArrayBuffer` of encoded audio bytes into a Web Audio
   * `AudioBuffer` using the engine's context. This is the seam
   * {@link AssetLibrary} uses to decode {@link AudioAsset}s after fetching
   * the raw bytes — exposed so tests and advanced callers can decode bytes
   * they obtained through other means (e.g. a recorder, a custom loader).
   *
   * @param bytes Encoded audio bytes (MP3, OGG, WAV, etc.).
   * @returns A promise resolving to the decoded buffer.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.AUDIO_UNAVAILABLE} when the engine is in headless
   *   mode.
   */
  public async decodeAudioData(bytes: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this._context;
    if (!ctx) {
      throwEngineError(
        ErrorCode.AUDIO_UNAVAILABLE,
        'Cannot decode audio — the AudioEngine is in headless mode (no ' +
          'AudioContext available). Provide a real browser environment, or ' +
          'mock AudioEngine.decodeAudioData in your tests.',
        {},
      );
    }

    return ctx.decodeAudioData(bytes);
  }

  /**
   * Convenience wrapper around `fetch` + {@link AudioEngine.decodeAudioData}:
   * loads the bytes at `path` and returns the decoded buffer.
   *
   * This is the path {@link AssetLibrary} takes for audio asset loads. Most
   * game code uses {@link AssetLibrary.load} (or a bundle) and never reaches
   * for this directly; reach for it when you need a one-off decode outside
   * the asset library's lifecycle model.
   *
   * @param path A path or URL the browser's `fetch` can resolve.
   * @returns The decoded {@link AudioBuffer}.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.AUDIO_UNAVAILABLE} when the engine is in headless
   *   mode.
   * @throws Any error `fetch` or `decodeAudioData` produces. Callers that
   *   want the engine-error wrapping go through {@link AssetLibrary.load}.
   */
  public async loadAudioBuffer(path: string): Promise<AudioBuffer> {
    const ctx = this._context;
    if (!ctx) {
      throwEngineError(
        ErrorCode.AUDIO_UNAVAILABLE,
        `Cannot load audio "${path}" — the AudioEngine is in headless mode ` +
          `(no AudioContext available).`,
        { path },
      );
    }

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch audio "${path}": HTTP ${response.status} ${response.statusText}`,
      );
    }
    const bytes = await response.arrayBuffer();
    return this.decodeAudioData(bytes);
  }

  /**
   * Constructs a fresh {@link AudioInstance} routed through the requested
   * {@link AudioCategory}. The instance is created in the `idle` state —
   * call {@link AudioInstance.play} to start playback.
   *
   * @param buffer The decoded audio buffer to play. Typically
   * {@link AudioAsset.raw}.
   * @param category The category bus to route through —
   * {@link AudioCategory.Music} for long-lived music, {@link AudioCategory.Sfx}
   * for short-lived effects.
   * @param options Optional per-instance settings (volume, pan, loop).
   * @returns A fresh {@link AudioInstance}.
   */
  public createInstance(
    buffer: AudioBuffer,
    category: AudioCategory,
    options: AudioInstanceOptions = {},
  ): AudioInstance {
    const gain =
      category === AudioCategory.Music ? this._musicGain : this._sfxGain;
    return new AudioInstance(this, buffer, gain, options);
  }

  /**
   * Closes the underlying `AudioContext` and drops the engine's
   * references. Idempotent; safe to call multiple times. Invoked
   * automatically when the {@link Game} tears down.
   */
  public override onDestroy(): void {
    const ctx = this._context;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close();
    }
  }
}

/**
 * Resolves the runtime's `AudioContext` constructor, falling back to the
 * vendor-prefixed `webkitAudioContext` for older Safari builds. Returns
 * `undefined` outside a browser, where the engine is expected to operate
 * headlessly.
 *
 * @internal
 */
function resolveAudioContextCtor(): AudioContextConstructor | undefined {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }
  const g = globalThis as Record<string, unknown>;
  const ctor = g['AudioContext'] ?? g['webkitAudioContext'];
  return typeof ctor === 'function'
    ? (ctor as AudioContextConstructor)
    : undefined;
}
