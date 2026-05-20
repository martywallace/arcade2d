import { Point } from '../geometry';
import { WorldComponent } from './dependencies';
import { World } from './world';

/**
 * The world's viewport — a "look-at point" in world space, plus an
 * orientation, that downstream presentation components (notably
 * {@link Scene}) use to decide what part of the world ends up on screen.
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
 *
 * Both fields default to a neutral state (`(0, 0)`, `0 radians`). With the
 * default camera, the world's origin appears at the centre of the canvas
 * and the world's axes line up with the canvas's.
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
 * "Behaviours" traditionally implemented as camera components on a camera
 * entity (follow, shake, ease-to-target) live more naturally as small
 * helpers or world-scoped systems that read and write this camera's state
 * each tick — they don't need to be `WorldObject` components to do their
 * job.
 *
 * @example
 * ```typescript
 * // Camera-follow-player: copy the player's position into the camera once
 * // per frame so the player stays centred on screen.
 * class CameraFollow implements WorldObjectComponent {
 *   constructor(public readonly host: WorldObject) {}
 *
 *   onAdded() {}
 *
 *   onPostUpdate() {
 *     this.host.world.camera.position.copyFrom(this.host.position);
 *   }
 *
 *   onUpdate() {}
 *   onDestroy() {}
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Slowly spin the world for a stylised effect.
 * world.camera.rotation += 0.01;
 * ```
 */
export class Camera implements WorldComponent {
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

  constructor(public readonly host: World) {}

  public onAdded(): void {}

  public onUpdate(): void {}

  public onDestroy(): void {}
}
