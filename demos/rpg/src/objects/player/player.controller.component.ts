import type { WorldUpdate } from '@arcade2d/engine';
import {
  AbstractWorldObjectComponent,
  AudioSource,
  Point,
  Random,
  RigidBody,
  Scene,
  WorldTimer,
} from '@arcade2d/engine';
import {
  BULLET_SPEED,
  CAMERA_EASE_RATE,
  CAMERA_LOOK_AHEAD,
  PLAYER_FIRE_INTERVAL,
  PLAYER_FIRE_SPREAD,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  WORLD_HALF,
} from '../../constants';
import { Health } from '../../components/health.component';
import { BulletPrefab } from '../bullet/bullet.prefab';

/** Clamps `value` to the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamps a camera-axis coordinate so a viewport of half-size `halfView` stays
 * inside the world's `±WORLD_HALF` bounds. When the viewport is larger than the
 * world on this axis there is no valid range, so it centres on the origin.
 */
function clampCameraAxis(value: number, halfView: number): number {
  const edge = WORLD_HALF - halfView;
  return edge > 0 ? clamp(value, -edge, edge) : 0;
}

/**
 * Drives the player: WASD sets the body's velocity (so the physics solver
 * stops it dead against walls), the sprite turns to face the mouse, the camera
 * eases toward a point between the player and the cursor, and left-click fires
 * bullets toward the cursor.
 *
 * ## Staying on the ground
 *
 * Two clamps keep the action inside the tiled ground (a {@link WORLD_HALF}
 * square around the origin):
 *
 * - The **player** is held inside the bounds, inset by {@link PLAYER_RADIUS} so
 *   the sprite never overhangs the edge. Because the body is dynamic — the
 *   physics solver owns its translation — the correction is pushed straight to
 *   the Rapier body via {@link RigidBody.raw}; writing `host.position` alone
 *   would be overwritten by the next pre-update readback.
 * - The **camera** is held so its viewport never shows past the ground edge.
 *   The viewport half-size in world units is recovered from the {@link Scene}
 *   (`camera.position - screenToWorld(top-left corner)`), so the clamp tracks
 *   the live canvas size and zoom.
 *
 * ## Why facing works on a physics body
 *
 * The body is dynamic with locked rotation, so the simulation owns the
 * transform and would otherwise pin `host.rotation` to zero. This controller
 * runs in the update phase — *after* {@link RigidBody} reads the body back in
 * pre-update, and *before* the graphics sync in post-update — so writing
 * `host.rotation` here is the value the sprite renders with this frame. The
 * locked body never spins, the visual always aims at the cursor.
 *
 * The {@link RigidBody} sibling is resolved on `onAdded` so velocity can be set
 * every frame without a per-frame component lookup.
 */
export class PlayerController extends AbstractWorldObjectComponent {
  private readonly _fireCooldown = new WorldTimer(PLAYER_FIRE_INTERVAL);
  private readonly _random = new Random();

  // Scratch point for the camera focus, reused each frame to avoid a per-frame
  // allocation in the update hot path.
  private readonly _cameraFocus = Point.zero();

  private _body!: RigidBody;
  private _health!: Health;
  private _gunshot!: AudioSource;

  public override onAdded(): void {
    this._body = this.host.getComponentByType(RigidBody);
    this._health = this.host.getComponentByType(Health);
    this._gunshot = this.host.getComponentByType(AudioSource);
  }

  public override onUpdate(update: WorldUpdate): void {
    // Overwhelmed: the player's Health survives depletion (destroyOnDeath is
    // off), so respawn it in place at full health with a jolt of camera shake
    // rather than ending the demo.
    if (this._health.isDead) {
      this._health.restore();
      this.world.camera.shake(16, 320);
    }

    const keyboard = this.game.getKeyboardState();

    // Screen-axis movement, normalised so diagonals aren't faster. Velocity is
    // re-set every frame (zero when idle), so releasing the keys stops the
    // player crisply and walls simply zero the into-wall component.
    let dx = 0;
    let dy = 0;

    if (keyboard.isDown('KeyW')) dy -= 1;
    if (keyboard.isDown('KeyS')) dy += 1;
    if (keyboard.isDown('KeyA')) dx -= 1;
    if (keyboard.isDown('KeyD')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const angle = Math.atan2(dy, dx);
      this._body.velocity = {
        x: Math.cos(angle) * PLAYER_SPEED,
        y: Math.sin(angle) * PLAYER_SPEED,
      };
    } else {
      this._body.velocity = { x: 0, y: 0 };
    }

    // Keep the player on the tiled ground. The body is dynamic, so teleport it
    // with RigidBody.setPosition — writing host.position alone would be
    // clobbered by RigidBody's next pre-update readback. Inset by the radius so
    // the sprite never overhangs the edge. Zero the outward velocity component
    // on the axis that hit, so the next physics step doesn't drive the body
    // back out and jitter against the wall.
    const limit = WORLD_HALF - PLAYER_RADIUS;
    const pos = this.host.position;
    const clampedX = clamp(pos.x, -limit, limit);
    const clampedY = clamp(pos.y, -limit, limit);
    const hitX = clampedX !== pos.x;
    const hitY = clampedY !== pos.y;

    if (hitX || hitY) {
      this._body.setPosition({ x: clampedX, y: clampedY });

      const velocity = this._body.velocity;
      this._body.velocity = {
        x: hitX ? 0 : velocity.x,
        y: hitY ? 0 : velocity.y,
      };
    }

    // Face the cursor. Overrides the body's pre-update rotation readback for
    // this frame's render (see the class doc).
    const mouse = this.world.getMouseState();
    const aim = this.host.position.angleTo(mouse.position);
    this.host.rotation = aim;

    // Camera leads from the player toward the cursor and eases in, rather than
    // snapping to the player. The focus is a point CAMERA_LOOK_AHEAD of the way
    // from the player to the mouse, so aiming reveals more of the world ahead.
    // The ease is exponential smoothing made frame-rate-independent by feeding
    // the frame delta through it, so the feel is identical at 30 or 144fps.
    const focus = this._cameraFocus
      .copyFrom(this.host.position)
      .lerp(mouse.position, CAMERA_LOOK_AHEAD);
    const t =
      1 - Math.exp((-CAMERA_EASE_RATE * update.deltaMilliseconds) / 1000);
    const camera = this.world.camera.position;
    camera.lerp(focus, t);

    // Hold the viewport inside the ground: never let a screen edge show past the
    // world bounds. The viewport's world-space half-size is the gap between the
    // camera centre and the world point under the top-left screen corner, so the
    // clamp tracks the live canvas size and zoom.
    const corner = this.world.getComponentByType(Scene).screenToWorld({
      x: 0,
      y: 0,
    });
    camera.set(
      clampCameraAxis(camera.x, Math.abs(camera.x - corner.x)),
      clampCameraAxis(camera.y, Math.abs(camera.y - corner.y)),
    );

    // Fire toward the cursor on left-click, with a touch of spread.
    if (
      mouse.buttons.left &&
      this._fireCooldown.decrement(update.deltaMilliseconds).isLapsed
    ) {
      this._fire(aim);
      this._fireCooldown.reset();
    }
  }

  private _fire(aim: number): void {
    // A fresh voice per shot, so a rapid burst layers overlapping reports rather
    // than restarting one clip.
    this._gunshot.play();

    const angle =
      aim + this._random.between(-PLAYER_FIRE_SPREAD, PLAYER_FIRE_SPREAD);

    // Spawn just past the muzzle so the bullet doesn't start inside the player.
    const muzzle = PLAYER_RADIUS + 10;
    const bullet = this.world.createFromPrefab(BulletPrefab, {
      x: this.host.position.x + Math.cos(angle) * muzzle,
      y: this.host.position.y + Math.sin(angle) * muzzle,
    });

    // The bullet's body exists immediately (onAdded ran during the build), so
    // its launch velocity can be set right away.
    bullet.getComponentByType(RigidBody).velocity = {
      x: Math.cos(angle) * BULLET_SPEED,
      y: Math.sin(angle) * BULLET_SPEED,
    };
  }
}
