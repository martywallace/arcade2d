import type { PointPrimitive } from '../geometry/point.types';

/**
 * Component key the engine convention reserves for the world's
 * {@link PhysicsWorld}. Unlike {@link Scene} or the input samplers,
 * `PhysicsWorld` is **not** auto-attached — physics is opt-in — but when a
 * game does register one, using this key keeps it discoverable by tooling and
 * by `world.getComponent(PHYSICS_WORLD_COMPONENT_KEY)`.
 */
export const PHYSICS_WORLD_COMPONENT_KEY = 'physics';

/**
 * Default gravity, in **pixels per second squared**, applied when
 * {@link PhysicsWorldOptions.gravity} is omitted. Points down the screen
 * (positive `y`), matching the engine's screen-space convention where `y`
 * increases downward. Tuned for the engine's default pixel scale — a sane
 * "things fall" value rather than a literal `9.81`.
 */
export const DEFAULT_GRAVITY: PointPrimitive = { x: 0, y: 980 };

/**
 * Default value for {@link PhysicsWorldOptions.pixelsPerMeter}. Wired straight
 * into Rapier's `lengthUnit`, telling the solver that "one human-scale meter"
 * is 50 pixels so its internal error tolerances, sleep thresholds, and
 * prediction distances are sized correctly for a pixel-scale world. A typical
 * 30–100px arcade body then lands in Rapier's numerically-happy range.
 */
export const DEFAULT_PIXELS_PER_METER = 50;

/**
 * Default fixed simulation timestep, in seconds — one sixtieth of a second,
 * i.e. a 60 Hz physics tick. The {@link PhysicsWorld} accumulates real frame
 * time and advances the simulation in increments of this value so behaviour is
 * independent of the display's refresh rate.
 */
export const DEFAULT_FIXED_TIME_STEP = 1 / 60;

/**
 * Default cap on how many fixed steps {@link PhysicsWorld} will run in a
 * single frame. Bounds the catch-up work after a long stall (a backgrounded
 * tab, a GC pause) so the simulation never enters a "spiral of death" where
 * each frame owes more steps than it can afford — past the cap, the leftover
 * time is dropped and the simulation runs in slow motion for that one frame
 * instead of freezing.
 */
export const DEFAULT_MAX_SUB_STEPS = 5;
