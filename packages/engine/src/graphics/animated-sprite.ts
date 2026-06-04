import { Sprite as PixiSprite } from 'pixi.js';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import type { WorldObject, WorldUpdate } from '../world';
import { AbstractTexturedGraphics } from './abstract-textured-graphics';
import type { AnimatedSpriteOptions } from './animated-sprite.types';
import { Texture } from './texture';

/**
 * Renders a sequence of {@link Texture} frames attached to a
 * {@link WorldObject}, advancing through them on a timer to produce a
 * flip-book animation — the standard way to put a walk cycle, an idle loop, or
 * a one-shot effect on screen.
 *
 * Like {@link Sprite}, it wraps a renderer `Sprite` and builds on
 * {@link AbstractGraphics}, so it inherits scene-parenting and the
 * once-per-frame transform sync (position, rotation, scale track the host).
 * What it adds is a playhead over a fixed `Texture[]`: each tick it accumulates
 * elapsed time and swaps the displayed frame whenever a frame's duration has
 * passed.
 *
 * ## Frames and timing
 *
 * The frames are supplied once at construction — typically from
 * {@link Texture.grid}, which slices a strip or sheet into ordered cells — and
 * are not mutated afterward. Playback speed is set in frames per second
 * ({@link AnimatedSpriteOptions.fps}); the per-frame duration is `1000 / fps`
 * milliseconds. Time is accumulated rather than snapped to ticks, so a fast
 * animation on a slow frame still advances by the right number of frames
 * (it can skip frames if a tick is long).
 *
 * ## Looping and completion
 *
 * By default the playhead wraps from the last frame back to the first
 * forever. With {@link AnimatedSpriteOptions.loop} `false`, it instead holds
 * on the final frame, stops, and fires
 * {@link AnimatedSpriteOptions.onComplete} once — the model for one-shot
 * effects (an explosion, a pickup sparkle) that should play through and freeze.
 *
 * ## Sizing
 *
 * Identical to {@link Sprite}: the intrinsic size is the current frame's pixel
 * size, and there is no width/height setter — scale the host
 * (`host.scale.set(2, 2)`) to draw larger or smaller. Frames are assumed to
 * share a size (the {@link Texture.grid} case); mixing sizes is allowed but the
 * anchor is a per-frame fraction, so off-size frames anchor by their own size.
 *
 * @example
 * ```ts
 * // A 4-frame idle loop sliced from a horizontal strip, at 8 fps.
 * const frames = Texture.grid(game.assets.getAs('coin', ImageAsset), {
 *   frameWidth: 16,
 *   frameHeight: 16,
 *   columns: 4,
 *   rows: 1,
 * });
 *
 * coin.addComponentFromFactory(
 *   'sprite',
 *   (host) => new AnimatedSprite(host, frames, { fps: 8 }),
 * );
 * ```
 *
 * @example
 * ```ts
 * // A one-shot effect that plays once and removes its object when done.
 * new AnimatedSprite(host, explosionFrames, {
 *   fps: 24,
 *   loop: false,
 *   onComplete: () => host.destroy(),
 * });
 * ```
 *
 * @see {@link Sprite} for a single static frame.
 * @see {@link Texture.grid} for producing the frame array.
 * @see {@link AbstractGraphics} for the inherited lifecycle and transform sync.
 */
export class AnimatedSprite extends AbstractTexturedGraphics<PixiSprite> {
  private readonly _frames: readonly Texture[];
  private readonly _onComplete?: () => void;

  private _frameDurationMs: number;
  private _loop: boolean;
  private _playing: boolean;
  private _index = 0;

  // Accumulated time since the current frame was shown. Time is banked rather
  // than snapped to ticks so playback rate is independent of frame rate.
  private _elapsed = 0;

  /**
   * @param host The {@link WorldObject} this sprite is attached to. Its
   * transform drives the sprite's position, rotation, and scale each frame.
   * @param frames The animation frames, in playback order. Held by reference,
   * not cloned — the textures' pixels are owned by their {@link ImageAsset}.
   * Must contain at least one frame.
   * @param options Optional {@link AnimatedSpriteOptions} (rate, looping,
   * autoplay, completion callback, and the usual anchor/tint/alpha/visibility).
   * @throws An {@link EngineError} with code
   * {@link ErrorCode.ANIMATED_SPRITE_EMPTY_FRAMES} when `frames` is empty —
   * an animation with no frames has nothing to draw and is always a
   * programming error.
   * @throws An {@link EngineError} with code
   * {@link ErrorCode.ANIMATED_SPRITE_INVALID_FPS} when
   * {@link AnimatedSpriteOptions.fps} is not a positive, finite number.
   */
  constructor(
    host: WorldObject,
    frames: readonly Texture[],
    options: AnimatedSpriteOptions = {},
  ) {
    if (frames.length === 0) {
      throwEngineError(
        ErrorCode.ANIMATED_SPRITE_EMPTY_FRAMES,
        'AnimatedSprite requires at least one frame.',
      );
    }

    // Length-checked above; safe under noUncheckedIndexedAccess.
    super(host, new PixiSprite(frames[0]!.raw), options);

    this._frames = frames;
    this._frameDurationMs = AnimatedSprite._frameDurationFromFps(
      options.fps ?? 12,
    );
    this._loop = options.loop ?? true;
    this._playing = options.autoplay ?? true;
    this._onComplete = options.onComplete;
  }

  public override onUpdate(update: WorldUpdate): void {
    if (!this._playing || this._frames.length <= 1) {
      return;
    }

    this._elapsed += update.deltaMilliseconds;

    // Drain the accumulator a frame at a time so a long tick advances by
    // however many frames actually elapsed rather than just one.
    while (this._playing && this._elapsed >= this._frameDurationMs) {
      this._elapsed -= this._frameDurationMs;
      this._advance();
    }
  }

  /**
   * The number of frames in the animation.
   */
  public get frameCount(): number {
    return this._frames.length;
  }

  /**
   * The index of the frame currently displayed (`0`-based).
   */
  public get currentFrame(): number {
    return this._index;
  }

  /**
   * The {@link Texture} currently displayed.
   */
  public get texture(): Texture {
    // _index is always a valid index; safe under noUncheckedIndexedAccess.
    return this._frames[this._index]!;
  }

  /**
   * Whether the playhead is currently advancing. `false` after
   * {@link AnimatedSprite.pause}, {@link AnimatedSprite.stop}, or a non-looping
   * animation reaching its final frame.
   */
  public get isPlaying(): boolean {
    return this._playing;
  }

  /**
   * Whether playback wraps from the last frame back to the first. Settable at
   * runtime — flip a one-shot to looping or vice versa mid-playback.
   */
  public get loop(): boolean {
    return this._loop;
  }

  public set loop(value: boolean) {
    this._loop = value;
  }

  /**
   * Playback rate in frames per second. Setting it changes the per-frame
   * duration immediately; the current frame's already-banked time is kept, so
   * a rate change takes effect from the next frame boundary.
   *
   * @throws An {@link EngineError} with code
   * {@link ErrorCode.ANIMATED_SPRITE_INVALID_FPS} when assigned a value that
   * is not a positive, finite number.
   */
  public get fps(): number {
    return 1000 / this._frameDurationMs;
  }

  public set fps(value: number) {
    this._frameDurationMs = AnimatedSprite._frameDurationFromFps(value);
  }

  /**
   * Converts a frames-per-second rate into a per-frame duration in
   * milliseconds, rejecting rates that would make playback misbehave. A
   * zero/negative rate yields a non-positive duration (the drain loop in
   * `onUpdate` would never terminate), and a non-finite rate yields `NaN` or
   * `Infinity` (the playhead would never advance) — both are programming
   * errors, so we fail loudly rather than silently freeze the animation.
   */
  private static _frameDurationFromFps(fps: number): number {
    if (!Number.isFinite(fps) || fps <= 0) {
      throwEngineError(
        ErrorCode.ANIMATED_SPRITE_INVALID_FPS,
        `AnimatedSprite fps must be a positive, finite number (got ${fps}).`,
        { fps },
      );
    }

    return 1000 / fps;
  }

  /**
   * Resumes (or begins) advancing the playhead from the current frame. A no-op
   * if already playing. To replay a finished one-shot from the start, call
   * {@link AnimatedSprite.stop} first (or {@link AnimatedSprite.gotoFrame}).
   *
   * @returns `this`, for chaining.
   */
  public play(): this {
    this._playing = true;
    return this;
  }

  /**
   * Halts the playhead on the current frame without resetting it.
   *
   * @returns `this`, for chaining.
   */
  public pause(): this {
    this._playing = false;
    return this;
  }

  /**
   * Halts the playhead and resets it to the first frame.
   *
   * @returns `this`, for chaining.
   */
  public stop(): this {
    this._playing = false;
    this._elapsed = 0;
    this._setIndex(0);
    return this;
  }

  /**
   * Jumps the playhead to a specific frame, leaving the play/pause state
   * unchanged. The banked time is cleared so the new frame gets its full
   * duration.
   *
   * @param index The frame to show. Clamped to `[0, frameCount - 1]`.
   * @returns `this`, for chaining.
   */
  public gotoFrame(index: number): this {
    const clamped = Math.max(0, Math.min(index, this._frames.length - 1));
    this._elapsed = 0;
    this._setIndex(clamped);
    return this;
  }

  // Steps the playhead one frame forward, wrapping or completing at the end.
  private _advance(): void {
    if (this._index + 1 < this._frames.length) {
      this._setIndex(this._index + 1);
      return;
    }

    if (this._loop) {
      this._setIndex(0);
      return;
    }

    // Non-looping and already on the final frame: hold there, stop, and
    // signal completion exactly once.
    this._playing = false;
    this._elapsed = 0;
    this._onComplete?.();
  }

  private _setIndex(index: number): void {
    this._index = index;
    // _index is always valid; safe under noUncheckedIndexedAccess.
    this.raw.texture = this._frames[index]!.raw;
  }
}
