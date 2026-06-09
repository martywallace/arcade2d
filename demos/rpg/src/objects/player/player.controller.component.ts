import type { WorldUpdate } from '@arcade2d/engine';
import {
  AbstractWorldObjectComponent,
  Random,
  RigidBody,
  WorldTimer,
} from '@arcade2d/engine';
import {
  BULLET_SPEED,
  PLAYER_FIRE_INTERVAL,
  PLAYER_FIRE_SPREAD,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from '../../constants';
import { BulletPrefab } from '../bullet/bullet.prefab';

/**
 * Drives the player: WASD sets the body's velocity (so the physics solver
 * stops it dead against walls), the sprite turns to face the mouse, the camera
 * tracks the player, and left-click fires bullets toward the cursor.
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
  private _body!: RigidBody;

  public override onAdded(): void {
    this._body = this.host.getComponentByType(RigidBody);
  }

  public override onUpdate(update: WorldUpdate): void {
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

    // Face the cursor. Overrides the body's pre-update rotation readback for
    // this frame's render (see the class doc).
    const mouse = this.world.getMouseState();
    const aim = this.host.position.angleTo(mouse.position);
    this.host.rotation = aim;

    // Camera follows the player.
    this.world.camera.position.copyFrom(this.host.position);

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
