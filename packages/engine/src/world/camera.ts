import { Point } from '../geometry';
import { AbstractWorldComponent } from './abstract-world-component';
import { WorldUpdate } from './world-update';

/**
 * Internal state describing an in-flight camera shake. Exposed only via the
 * read-only {@link Camera.isShaking} / {@link Camera.shakeOffset} surface.
 *
 * @internal
 */
type ShakeState = {
  /**
   * Peak offset magnitude, in screen pixels. Linearly decays toward zero
   * as `elapsed` advances toward `duration`.
   */
  readonly intensity: number;

  /**
   * Total length of the shake, in real-world milliseconds.
   */
  readonly duration: number;

  /**
   * Time consumed by the shake so far, in milliseconds. Mutated each tick;
   * when it reaches `duration`, the shake ends.
   */
  elapsed: number;
};

/**
 * The world's viewport — a "look-at point" in world space, plus an
 * orientation and a zoom factor — that downstream presentation components
 * (notably {@link Scene}) use to decide what part of the world ends up on
 * screen.
 *
 * Every {@link World} owns exactly one `Camera`, attached automatically at
 * construction and accessible as a typed reference via {@link World.camera}.
 * There is no opt-in registration, no name to remember, and no risk of the
 * camera being missing — engine code that reads it can treat its presence
 * as an invariant.
 *
 * ### Semantics
 *
 * The camera is a *look-at point*, not a pan offset:
 *
 * - {@link Camera.position} is the world-space coordinate the camera is
 *   currently pointed at. {@link Scene} maps that point to the centre of
 *   the canvas — set `camera.position` to the player's position once per
 *   frame and the player stays anchored on screen as they move.
 * - {@link Camera.rotation} is the camera's roll, in radians. {@link Scene}
 *   applies its inverse to the scene container, so increasing the value
 *   rotates the *world* clockwise underneath a stationary viewer.
 * - {@link Camera.zoom} scales the rendered view; values greater than `1`
 *   zoom in (objects appear larger), values between `0` and `1` zoom out.
 *
 * All three fields default to a neutral state. With the default camera,
 * the world's origin appears at the centre of the canvas, the world's
 * axes line up with the canvas's, and one world unit equals one screen
 * pixel.
 *
 * ### Shake
 *
 * {@link Camera.shake} kicks off a temporary, decaying random offset
 * applied to the rendered view — the staple "impact" feedback for hits,
 * explosions, and screen-jolts. The shake lives entirely on the *render*
 * side: it adjusts {@link Camera.shakeOffset} each tick during the
 * camera's own `onUpdate`, and {@link Scene} reads that offset when it
 * applies the container transform. The logical {@link Camera.position}
 * and {@link Camera.rotation} are untouched, which means
 *
 * - {@link Mouse} (and any other code routing through
 *   {@link Scene.screenToWorld}) keeps landing on the world point the
 *   player actually aimed at, not a phantom shifted by the shake.
 * - Game logic that reads `camera.position` (e.g. a follow controller
 *   centring on the player) sees a stable value, not a jittering one.
 *
 * Intensity is expressed in **screen pixels** so the visual magnitude is
 * independent of `zoom`. Starting a new `shake` while one is already in
 * flight replaces it — the engine does not currently stack shakes.
 *
 * ### Why this isn't a `WorldObject`
 *
 * The camera looks superficially like it wants to be a `WorldObject` — it
 * has a transform, it sometimes follows a moving target. But a
 * `WorldObject` is a *thing inside* the world (findable by tag, iterated
 * during update, destroyable). The camera is the *lens through which* the
 * world is observed; modelling it as a sibling of every game entity
 * conflates the two roles. As a world-scoped component it stays out of
 * `findByTag`, never appears in object iteration, and can't be accidentally
 * destroyed.
 *
 * @example
 * ```typescript
 * // Camera-follow-player: copy the player's position into the camera once
 * // per frame so the player stays centred on screen. Run inside the
 * // player's `onUpdate` so Scene's post-update transform sync sees a
 * // settled camera before drawing.
 * class CameraFollow extends AbstractWorldObjectComponent {
 *   public onUpdate(): void {
 *     this.world.camera.position.copyFrom(this.host.position);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Shake the camera on every bullet impact.
 * onBulletHit() {
 *   world.camera.shake(8, 250);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Zoom in for a cinematic close-up.
 * world.camera.zoom = 2;
 * ```
 */
export class Camera extends AbstractWorldComponent {
  /**
   * The point in world space the camera is currently looking at. Mutable in
   * place — game code typically writes to this every frame to follow a
   * target (`camera.position.copyFrom(player.position)`).
   *
   * {@link Scene} maps this point to the centre of the canvas every frame.
   * With the default `(0, 0)`, the world's origin appears centred on
   * screen.
   */
  public readonly position: Point = Point.zero();

  /**
   * The camera's roll, in radians, measured clockwise (same convention as
   * {@link WorldObject.rotation} and the rest of the engine). Mutable.
   *
   * {@link Scene} applies the *inverse* of this rotation to the scene
   * container, so increasing the value rotates the world clockwise beneath
   * a stationary viewer.
   */
  public rotation = 0;

  /**
   * Uniform zoom factor applied by {@link Scene} when projecting world
   * coordinates to the screen. `1` (the default) is "1 world unit per 1
   * screen pixel"; values greater than `1` zoom in, values between `0`
   * and `1` zoom out. Negative or zero values produce undefined visual
   * results — neither the engine nor Pixi clamp them — so don't.
   */
  public zoom = 1;

  private _shake: ShakeState | null = null;
  private readonly _shakeOffset: Point = Point.zero();

  /**
   * The current shake-induced offset, in screen pixels. Zero unless a
   * shake is in flight. Exposed primarily so {@link Scene} can read it
   * during the post-update transform sync; game code rarely needs to
   * inspect it directly.
   *
   * The returned {@link Point} is the camera's live internal instance —
   * mutating it externally is a contract violation. Treat it as read-only.
   */
  public get shakeOffset(): Readonly<Point> {
    return this._shakeOffset;
  }

  /**
   * `true` if a {@link Camera.shake} is currently in flight. Goes back to
   * `false` automatically when the shake's duration elapses, or
   * immediately on {@link Camera.stopShake}.
   */
  public get isShaking(): boolean {
    return this._shake !== null;
  }

  /**
   * Starts a screen-shake effect. The shake adds a randomised offset to
   * {@link Camera.shakeOffset} once per tick, decaying linearly from
   * `intensity` at the start to zero at `duration`. {@link Scene} applies
   * the offset on top of the camera's logical position when it draws.
   *
   * Calling `shake` while another shake is still running **replaces** the
   * previous one — the engine does not currently stack shakes. Passing a
   * non-positive `intensity` or `duration` is a no-op (treated as a
   * {@link Camera.stopShake}).
   *
   * @param intensity Peak offset magnitude, in screen pixels.
   * @param duration How long the shake lasts, in real-world milliseconds.
   */
  public shake(intensity: number, duration: number): void {
    if (intensity <= 0 || duration <= 0) {
      this.stopShake();
      return;
    }

    this._shake = { intensity, duration, elapsed: 0 };
  }

  /**
   * Cancels any in-flight shake and snaps {@link Camera.shakeOffset} back
   * to zero on the next frame. Safe to call when no shake is active — it's
   * a no-op in that case.
   */
  public stopShake(): void {
    this._shake = null;
    this._shakeOffset.set(0, 0);
  }

  /**
   * Advances any in-flight shake by one tick. Computes a fresh random
   * offset inside a disc whose radius is the current (decayed) shake
   * intensity, then writes that to {@link Camera.shakeOffset} for
   * {@link Scene} to consume during the post-update phase.
   */
  public override onUpdate(update: WorldUpdate): void {
    const shake = this._shake;

    if (!shake) {
      return;
    }

    shake.elapsed += update.deltaMilliseconds;

    if (shake.elapsed >= shake.duration) {
      this.stopShake();
      return;
    }

    // Linear decay from full intensity at t=0 to zero at t=duration. The
    // result is a peak offset within ±`magnitude` along a uniformly random
    // direction — visually "random jitter, diminishing over time."
    const remaining = 1 - shake.elapsed / shake.duration;
    const magnitude = shake.intensity * remaining;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * magnitude;

    this._shakeOffset.set(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
    );
  }
}
