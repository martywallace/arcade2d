import type { AudioEngine } from './audio-engine';
import type { AudioInstanceOptions } from './audio-instance.types';

/**
 * One playing voice in the audio graph — a single connection of an
 * `AudioBuffer` through per-instance gain and panner nodes into a category
 * bus on the {@link AudioEngine}.
 *
 * `AudioInstance` is the handle the audio-playing components
 * ({@link AudioSource}, {@link Music}) work through. It exposes the standard
 * playback surface — play, pause, resume, stop, restart, volume, pan, loop
 * — and hides the Web Audio bookkeeping that makes them work (recreating
 * `AudioBufferSourceNode`s, tracking elapsed time across pause/resume).
 *
 * ## Pause semantics
 *
 * A Web Audio `AudioBufferSourceNode` cannot be paused once it has started
 * — it can only be stopped, and stopping is terminal. To implement
 * pause/resume, this class:
 *
 * 1. Records `currentTime` when {@link AudioInstance.play} starts the
 *    source, plus the buffer offset it was started at.
 * 2. On {@link AudioInstance.pause}, computes the elapsed playback position,
 *    clamps or wraps it against the buffer duration depending on
 *    {@link AudioInstance.loop}, stores it, and stops the source.
 * 3. On the next {@link AudioInstance.play}, allocates a fresh source and
 *    starts it from the stored offset.
 *
 * {@link AudioInstance.stop} resets the stored offset to zero, so the next
 * {@link AudioInstance.play} resumes from the beginning.
 *
 * ## Headless mode
 *
 * When the {@link AudioEngine} has no `AudioContext` (a headless test
 * environment, an SSR build, a browser that has audio disabled), every
 * playback method is a no-op that updates the internal state flags but does
 * not allocate Web Audio nodes. This mirrors the engine's input-component
 * behaviour: code keeps running, audio is silently inert.
 *
 * @see {@link AudioEngine.createInstance} for the construction entry point.
 */
export class AudioInstance {
  private _state: 'idle' | 'playing' | 'paused' | 'stopped' = 'idle';
  private _volume: number;
  private _pan: number;
  private _loop: boolean;
  private _gain: GainNode | null = null;
  private _panner: StereoPannerNode | null = null;
  private _source: AudioBufferSourceNode | null = null;

  // Audio context time at which the *currently-running* source was started.
  // Combined with _resumeOffset, this is what lets us compute "where in the
  // buffer are we now" without polling the source node.
  private _startedAtContextTime = 0;

  // Buffer offset the most recent (or next) source.start() begins playback
  // from. Zero for a fresh play, the pause position for a resume, and reset
  // to zero by stop/restart.
  private _resumeOffset = 0;

  /**
   * @param engine The {@link AudioEngine} this instance plays through.
   * Required for context access; the engine's master/category gain nodes
   * own the bus this instance ultimately feeds.
   * @param buffer The decoded Web Audio buffer. Typically taken from
   * {@link AudioAsset.raw}.
   * @param _categoryGain The category bus this instance routes into — the
   * music gain node for {@link Music}, the sfx gain node for
   * {@link AudioSource}. `null` only when the engine is headless, in which
   * case no Web Audio nodes are allocated at all.
   * @param options Optional {@link AudioInstanceOptions} (volume, pan, loop).
   */
  constructor(
    public readonly engine: AudioEngine,
    public readonly buffer: AudioBuffer,
    private readonly _categoryGain: GainNode | null,
    options: AudioInstanceOptions = {},
  ) {
    this._volume = options.volume ?? 1;
    this._pan = options.pan ?? 0;
    this._loop = options.loop ?? false;

    const ctx = engine.raw;
    if (ctx && _categoryGain) {
      this._gain = ctx.createGain();
      this._gain.gain.value = this._volume;
      this._panner = ctx.createStereoPanner();
      this._panner.pan.value = this._pan;
      this._gain.connect(this._panner);
      this._panner.connect(_categoryGain);
    }
  }

  /**
   * Duration of the underlying clip in seconds. Equivalent to
   * {@link AudioAsset.duration} for the asset this instance was built from.
   */
  public get duration(): number {
    return this.buffer.duration;
  }

  /**
   * Whether the clip is currently advancing through the buffer (a source
   * node is active and unpaused). Flips back to `false` when the clip
   * finishes its last loop or is paused/stopped.
   */
  public get playing(): boolean {
    return this._state === 'playing';
  }

  /**
   * Whether the clip is paused — {@link AudioInstance.play} will resume
   * from the saved position. Mutually exclusive with
   * {@link AudioInstance.playing}.
   */
  public get paused(): boolean {
    return this._state === 'paused';
  }

  /**
   * Whether the clip is not currently emitting audio — `true` when idle,
   * stopped, or paused; `false` while {@link AudioInstance.playing} is
   * `true`.
   */
  public get stopped(): boolean {
    return this._state === 'idle' || this._state === 'stopped';
  }

  /**
   * Per-instance volume from `0` to `1`. Setting it during playback ramps
   * the underlying gain instantly; setting it before {@link AudioInstance.play}
   * applies on the next start.
   */
  public get volume(): number {
    return this._volume;
  }

  public set volume(value: number) {
    this._volume = value;
    if (this._gain) {
      this._gain.gain.value = value;
    }
  }

  /**
   * Stereo pan from `-1` (left) to `1` (right). Setting it during playback
   * applies instantly to the underlying `StereoPannerNode`.
   */
  public get pan(): number {
    return this._pan;
  }

  public set pan(value: number) {
    this._pan = value;
    if (this._panner) {
      this._panner.pan.value = value;
    }
  }

  /**
   * Whether the clip should loop back to its start on reaching the end.
   * Changing this mid-play takes effect on the *currently-running* source —
   * a clip that has not yet hit its end will start (or stop) looping from
   * its next boundary.
   */
  public get loop(): boolean {
    return this._loop;
  }

  public set loop(value: boolean) {
    this._loop = value;
    if (this._source) {
      this._source.loop = value;
    }
  }

  /**
   * Starts playback from the saved position — zero on a fresh or stopped
   * instance, the pause offset on a paused one. Calling {@link AudioInstance.play}
   * on an already-playing instance is a no-op (use
   * {@link AudioInstance.restart} to restart from the beginning).
   *
   * In headless mode this transitions the state flags but allocates no
   * Web Audio nodes.
   */
  public play(): void {
    if (this._state === 'playing') {
      return;
    }

    this._startSource(this._resumeOffset);
    this._state = 'playing';
  }

  /**
   * Pauses playback in place. The next {@link AudioInstance.play} resumes
   * from this point. A no-op when the instance is not currently playing.
   */
  public pause(): void {
    if (this._state !== 'playing') {
      return;
    }

    const ctx = this.engine.raw;
    if (ctx) {
      const elapsed = ctx.currentTime - this._startedAtContextTime;
      let pos = this._resumeOffset + elapsed;
      pos = this._loop
        ? pos % this.buffer.duration
        : Math.min(pos, this.buffer.duration);
      this._resumeOffset = pos;
    }

    this._stopSource();
    this._state = 'paused';
  }

  /**
   * Stops playback and resets the resume offset to zero, so the next
   * {@link AudioInstance.play} starts from the beginning of the clip.
   * Idempotent — stopping an already-stopped instance is a no-op.
   */
  public stop(): void {
    this._stopSource();
    this._resumeOffset = 0;
    this._state = 'stopped';
  }

  /**
   * Stops the clip if it is running, resets the resume offset, then plays
   * from the start. Equivalent to {@link AudioInstance.stop} followed by
   * {@link AudioInstance.play} and the standard way to "play this sound
   * again from scratch."
   */
  public restart(): void {
    this._stopSource();
    this._resumeOffset = 0;
    this._startSource(0);
    this._state = 'playing';
  }

  /**
   * Tears the instance down completely: stops playback, disconnects every
   * node from the audio graph, and drops them. The instance is not reusable
   * after this call — discard the handle.
   *
   * Called automatically by {@link AudioSource} when a one-shot SFX
   * finishes and by {@link Music.onDestroy} when the host world tears down.
   */
  public destroy(): void {
    this._stopSource();
    this._gain?.disconnect();
    this._panner?.disconnect();
    this._gain = null;
    this._panner = null;
    this._state = 'stopped';
    this._resumeOffset = 0;
  }

  /**
   * Subscribes to the natural end of playback — the moment the source
   * reports `onended` because it finished its last loop (or because it was
   * stopped). Returns an unsubscribe function. Fires at most once per
   * `play()`, so call after each play if you want repeated notifications.
   *
   * {@link AudioSource} uses this to prune finished one-shot voices.
   */
  public onEnded(listener: () => void): () => void {
    this._endedListeners.add(listener);
    return () => {
      this._endedListeners.delete(listener);
    };
  }

  private readonly _endedListeners = new Set<() => void>();

  private _startSource(offset: number): void {
    const ctx = this.engine.raw;
    if (!ctx || !this._gain) {
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this._loop;
    src.connect(this._gain);

    src.onended = (): void => {
      // The onended fires for any termination — natural end *and* a manual
      // stop. We treat it as authoritative only when this source is still
      // the active one; _stopSource() nulls _source first, which is how a
      // manual stop is distinguished from a natural finish.
      if (this._source !== src) {
        return;
      }

      this._source = null;
      this._state = 'stopped';
      this._resumeOffset = 0;
      this._notifyEnded();
    };

    src.start(0, offset);
    this._source = src;
    this._startedAtContextTime = ctx.currentTime;
  }

  private _stopSource(): void {
    const src = this._source;
    if (!src) {
      return;
    }

    this._source = null;
    src.onended = null;
    try {
      src.stop();
    } catch {
      // start() on an unstarted source throws; we never call stop() on one
      // unstarted, but the try is a cheap belt-and-braces for the case
      // where a context was closed underneath us.
    }
    src.disconnect();
  }

  private _notifyEnded(): void {
    for (const listener of this._endedListeners) {
      try {
        listener();
      } catch {
        // Engine policy: a single bad listener never aborts the sweep over
        // the rest. We swallow here because the AudioInstance has no
        // generalised error-reporting host the way World does.
      }
    }
  }
}
