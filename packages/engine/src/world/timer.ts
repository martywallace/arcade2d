/**
 * A small accumulator-style timer for tracking elapsed real-world time across
 * frames. Game code typically needs one of two patterns:
 *
 * - **Lifetime / cooldown** — start at some duration, count down each frame,
 *   take action when the timer reaches zero (a bullet despawns, an ability
 *   becomes available again).
 * - **Recurring interval** — count down to zero, fire an action, then
 *   {@link WorldTimer.reset} to the original duration and repeat (a weapon
 *   that fires every 250ms, a spawner that drops an enemy every second).
 *
 * `WorldTimer` covers both by being a thin, mutable wrapper around a single
 * number, driven by the delta value threaded through each
 * {@link WorldUpdate}. The unit is real-world milliseconds; pass
 * `update.deltaMilliseconds` to {@link WorldTimer.increment} or
 * {@link WorldTimer.decrement} from inside a component's update hook and
 * the timer advances at wall-clock speed regardless of the engine's frame
 * rate.
 *
 * The mutators ({@link WorldTimer.increment}, {@link WorldTimer.decrement},
 * {@link WorldTimer.set}, {@link WorldTimer.reset}) all return `this` so that
 * common patterns read in a single statement.
 *
 * @example
 * ```typescript
 * // Lifetime: destroy this object once 1000ms have elapsed.
 * private readonly _lifetime = new WorldTimer(1000);
 *
 * onUpdate(update: WorldUpdate) {
 *   if (this._lifetime.decrement(update.deltaMilliseconds).isLapsed) {
 *     this.host.destroy();
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Recurring interval: fire a bullet every 250ms.
 * private readonly _fireCooldown = new WorldTimer(250);
 *
 * onUpdate(update: WorldUpdate) {
 *   if (this._fireCooldown.decrement(update.deltaMilliseconds).isLapsed) {
 *     this._spawnBullet();
 *     this._fireCooldown.reset();
 *   }
 * }
 * ```
 */
export class WorldTimer {
  private readonly _initial: number;
  private _value: number;

  /**
   * Creates a new timer holding the given starting value. The value passed
   * here is also remembered as the "initial" value used by
   * {@link WorldTimer.reset}, which makes the recurring-interval pattern a
   * one-liner.
   *
   * @param milliseconds The starting value, in real-world milliseconds.
   * Negative and zero values are permitted — a timer constructed with `0`
   * is already {@link WorldTimer.isLapsed} from the first frame.
   */
  constructor(milliseconds: number) {
    this._initial = milliseconds;
    this._value = milliseconds;
  }

  /**
   * The current value of the timer, in milliseconds. May be negative after
   * a {@link WorldTimer.decrement} call that overshoots zero — the engine
   * does not clamp, so the overshoot is available for callers that want to
   * preserve it (e.g. by carrying it into the next interval via
   * {@link WorldTimer.increment}).
   */
  public get value(): number {
    return this._value;
  }

  /**
   * The value this timer was originally constructed with, and the value
   * {@link WorldTimer.reset} returns to. Exposed for the rare case where a
   * caller wants to reason about the timer's nominal duration after
   * mutating the current value.
   */
  public get initial(): number {
    return this._initial;
  }

  /**
   * `true` once the timer has counted down to zero or below. Designed for
   * decrement-style use: drive the timer with `decrement(update.deltaMilliseconds)` and
   * branch on `isLapsed` to fire whatever effect the timer is gating.
   *
   * For increment-style use (counting up to a threshold) compare
   * {@link WorldTimer.value} directly against the threshold instead.
   */
  public get isLapsed(): boolean {
    return this._value <= 0;
  }

  /**
   * Advances the timer forward by `delta` milliseconds. Typically called
   * with `update.deltaMilliseconds` from inside a component's update hook.
   *
   * @param delta Milliseconds to add to the current value. Negative inputs
   * are accepted and simply move the value the other way; this is
   * equivalent to calling {@link WorldTimer.decrement}.
   *
   * @returns This timer, so calls can chain (e.g.
   * `timer.increment(update.deltaMilliseconds).isLapsed`).
   */
  public increment(delta: number): this {
    this._value += delta;

    return this;
  }

  /**
   * Advances the timer backward by `delta` milliseconds. Typically called
   * with `update.deltaMilliseconds` from inside a component's update hook.
   *
   * @param delta Milliseconds to subtract from the current value. Negative
   * inputs are accepted and move the value the other way; this is
   * equivalent to calling {@link WorldTimer.increment}.
   *
   * @returns This timer, so calls can chain (e.g.
   * `timer.decrement(update.deltaMilliseconds).isLapsed`).
   */
  public decrement(delta: number): this {
    this._value -= delta;

    return this;
  }

  /**
   * Overwrites the current value. Does **not** change the value used by
   * {@link WorldTimer.reset} — the original "initial" remains whatever was
   * passed to the constructor.
   *
   * @param milliseconds The new current value.
   *
   * @returns This timer, for chaining.
   */
  public set(milliseconds: number): this {
    this._value = milliseconds;

    return this;
  }

  /**
   * Restores the current value to whatever this timer was constructed with.
   * Pairs naturally with the recurring-interval pattern — when the timer
   * lapses, fire the effect and `reset()` to start the next interval.
   *
   * @returns This timer, for chaining.
   */
  public reset(): this {
    this._value = this._initial;

    return this;
  }
}
