import type { WorldUpdate } from '@arcade2d/engine';
import { AbstractWorldObjectComponent, Random, WorldTimer } from '@arcade2d/engine';
import { BulletPrefab } from '../bullet/bullet.prefab';

/**
 * Half-width of the random firing spread, in radians (~8.6deg either side of
 * the aim line). Each shot is nudged by a uniform value in [-SPREAD, +SPREAD]
 * so fire isn't pixel-perfectly on the cursor.
 */
const FIRE_SPREAD = 0.15;

/**
 * Drives the player: WASD moves along the screen axes (not toward the
 * mouse), the camera is pinned to the player each frame, and left-click
 * fires a bullet toward the mouse. The player sprite itself never rotates.
 *
 * No resolveDependencies — input comes through the world-level
 * `world.getMouseState()` / `game.getKeyboardState()` accessors, and the
 * camera is reached via `world.camera`. No sibling or cross-tier component
 * reference is needed.
 */
export class PlayerController extends AbstractWorldObjectComponent {
  private readonly _fireCooldown = new WorldTimer(250);
  private readonly _random = new Random();

  public override onAdded(): void {
    console.log(`Added player controller to ${this.host.metadata.id}`);
  }

  public override onUpdate(update: WorldUpdate): void {
    const keyboard = this.game.getKeyboardState();
    const distance = 0.4 * update.deltaMilliseconds;

    // Literal screen-axis movement: W/S = up/down, A/D = left/right,
    // independent of where the mouse is aiming.
    let dx = 0;
    let dy = 0;

    if (keyboard.isDown('KeyW')) dy -= 1;
    if (keyboard.isDown('KeyS')) dy += 1;
    if (keyboard.isDown('KeyA')) dx -= 1;
    if (keyboard.isDown('KeyD')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      // atan2 normalises the direction so diagonal movement isn't faster.
      this.host.position.moveInDirection(Math.atan2(dy, dx), distance);
    }

    // Camera tracks the player every frame.
    this.world.camera.position.copyFrom(this.host.position);

    // Fire toward the mouse on left click. Only the bullet faces its travel
    // direction; the player sprite stays upright.
    const mouse = this.world.getMouseState();

    if (
      mouse.buttons.left &&
      this._fireCooldown.decrement(update.deltaMilliseconds).isLapsed
    ) {
      const bullet = this.world.createFromPrefab(
        BulletPrefab,
        this.host.position,
      );
      // Aim at the cursor, then jitter by a small random spread so shots
      // aren't perfectly on-target.
      bullet.rotation =
        this.host.position.angleTo(mouse.position) +
        this._random.between(-FIRE_SPREAD, FIRE_SPREAD);

      this._fireCooldown.reset();
    }
  }
}
