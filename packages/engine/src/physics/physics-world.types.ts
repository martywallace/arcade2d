import type { PointPrimitive } from '../geometry/point.types';

/**
 * Construction options for a {@link PhysicsWorld}. Every field is optional;
 * the defaults (see {@link PhysicsWorld}) produce a downward-gravity world
 * stepping at 60 Hz, suitable for a typical pixel-scale arcade game.
 *
 * All quantities are expressed in the engine's native **pixel** units —
 * gravity in pixels per second squared, the same coordinate space a
 * {@link WorldObject}'s `position` lives in. The {@link PhysicsWorldOptions.pixelsPerMeter}
 * knob keeps the underlying solver numerically stable at that scale without
 * the caller ever leaving pixels.
 */
export interface PhysicsWorldOptions {
  /**
   * Constant acceleration applied to every dynamic body, in pixels per second
   * squared. Defaults to `{ x: 0, y: 980 }` — straight down the screen, since
   * the engine's `y` axis increases downward. Pass `{ x: 0, y: 0 }` for a
   * top-down game with no gravity.
   */
  readonly gravity?: PointPrimitive;

  /**
   * How many pixels make up one simulated "meter". Forwarded to Rapier's
   * `lengthUnit`, which scales the solver's internal tolerances (allowed
   * penetration, prediction distance, sleep thresholds) so a pixel-scale
   * world behaves as stably as a metre-scale one. It does **not** rescale
   * your coordinates — positions, sizes, and velocities stay in pixels.
   *
   * Set it to roughly the size, in pixels, of a typical dynamic body in your
   * game (Rapier's own guidance). Defaults to `50`.
   */
  readonly pixelsPerMeter?: number;

  /**
   * The fixed timestep the simulation advances by, in seconds. Defaults to
   * `1 / 60`. Smaller values increase accuracy and cost; the value should
   * stay constant for the lifetime of the world to avoid solver instability.
   */
  readonly fixedTimeStep?: number;

  /**
   * The maximum number of fixed steps {@link PhysicsWorld} runs in a single
   * frame before discarding the remaining accumulated time. Bounds catch-up
   * work after a stall so the simulation can't spiral. Defaults to `5`.
   */
  readonly maxSubSteps?: number;
}
