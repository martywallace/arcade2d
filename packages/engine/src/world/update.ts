/**
 * The per-tick context produced by {@link World.update} and threaded into
 * every component's `onPreUpdate`, `onUpdate`, and `onPostUpdate` hook for
 * the duration of that tick.
 *
 * `WorldUpdate` is the canonical place to read timing information during
 * behavior code:
 *
 * - {@link WorldUpdate.deltaMilliseconds} / {@link WorldUpdate.deltaSeconds}
 *   — the wall-clock time since the previous tick, in either unit. Multiply
 *   by per-tick rates to make movement frame-rate-independent.
 * - {@link WorldUpdate.elapsedMilliseconds} /
 *   {@link WorldUpdate.elapsedSeconds} — the total time since the world's
 *   first tick. Useful for animation curves, lifetimes, or anything driven
 *   by absolute time rather than per-frame delta.
 * - {@link WorldUpdate.frameIndex} — a monotonic tick counter starting at
 *   `0` for the world's first tick. Unlocks "every N frames" patterns,
 *   reproducible debug stops, and deterministic phase offsets.
 *
 * Both unit pairs are derived from the same underlying measurement; pick
 * whichever reads best at the call site. The seconds-based variants are the
 * conventional unit for game-physics math
 * (`velocity * update.deltaSeconds`); the millisecond-based variants match
 * arcade2d's {@link WorldTimer} unit so timer ticks compose without
 * conversion.
 *
 * ### First-tick behavior
 *
 * On the world's very first tick there is no prior timestamp to diff
 * against, so `deltaMilliseconds` (and therefore `deltaSeconds`) is
 * deliberately `0`. This prevents the inaugural tick from emitting a
 * gigantic delta that would teleport every moving entity. Behavior code can
 * rely on `update.deltaMilliseconds === 0` meaning "no time advanced" and
 * skip work accordingly.
 *
 * @example
 * ```ts
 * onUpdate(update: WorldUpdate): void {
 *   // seconds-based: idiomatic for physics
 *   this.host.position.x += this._velocity * update.deltaSeconds;
 *
 *   // milliseconds-based: pairs with WorldTimer
 *   if (this._cooldown.decrement(update.deltaMilliseconds).isLapsed) {
 *     this.fire();
 *   }
 *
 *   // frame-stride pattern
 *   if (update.frameIndex % 30 === 0) {
 *     this.sampleEnvironment();
 *   }
 * }
 * ```
 */
export class WorldUpdate {
  /**
   * The time since the previous tick, in milliseconds. Always `0` on the
   * world's first tick. Always non-negative.
   */
  public readonly deltaMilliseconds: number;

  /**
   * The total time since the world's first tick, in milliseconds. `0` on
   * the very first tick, then accumulates monotonically.
   */
  public readonly elapsedMilliseconds: number;

  /**
   * A monotonic tick counter. `0` on the world's first tick, incrementing
   * by `1` on every subsequent {@link World.update} call.
   */
  public readonly frameIndex: number;

  /**
   * @param deltaMilliseconds The time since the previous tick, in
   * milliseconds. Pass `0` for the first tick (when there is no prior
   * timestamp). Expected to be non-negative; the caller is responsible for
   * clamping negative jumps from non-monotonic clocks before construction.
   * @param elapsedMilliseconds The total time since the world's first
   * tick, in milliseconds.
   * @param frameIndex The zero-based tick counter for this update.
   */
  constructor(
    deltaMilliseconds: number,
    elapsedMilliseconds: number,
    frameIndex: number,
  ) {
    this.deltaMilliseconds = deltaMilliseconds;
    this.elapsedMilliseconds = elapsedMilliseconds;
    this.frameIndex = frameIndex;
  }

  /**
   * The time since the previous tick, in seconds. Convenience accessor
   * equal to `deltaMilliseconds / 1000`. The idiomatic unit for
   * per-second-rate game math (`velocity * deltaSeconds`).
   */
  public get deltaSeconds(): number {
    return this.deltaMilliseconds / 1000;
  }

  /**
   * The total time since the world's first tick, in seconds. Convenience
   * accessor equal to `elapsedMilliseconds / 1000`.
   */
  public get elapsedSeconds(): number {
    return this.elapsedMilliseconds / 1000;
  }
}
