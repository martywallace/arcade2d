import type { WorldUpdate } from '@arcade2d/engine';
import { AbstractWorldObjectComponent, WorldTimer } from '@arcade2d/engine';
import { BulletPrefab } from '../bullet/bullet.prefab';

/**
 * The player has no resolveDependencies — mouse input comes through the
 * world-level `world.getMouseState()` accessor (which forwards to the
 * auto-registered input sampler), and facing is written into
 * `host.rotation` where the graphics component reads it back during its
 * own `onPostUpdate`. No direct sibling or cross-tier component reference
 * is needed.
 */
export class PlayerController extends AbstractWorldObjectComponent {
  private readonly _fireCooldown = new WorldTimer(100);

  public override onAdded(): void {
    console.log(`Added player controller to ${this.host.metadata.id}`);
  }

  public override onUpdate(update: WorldUpdate): void {
    const mouse = this.world.getMouseState();
    const keyboard = this.game.getKeyboardState();
    const angle = this.host.position.angleTo(mouse.position);

    // Move towards mouse.
    // if (
    //   mouse.position.distanceTo(this.host.position) > 10
    // ) {
    //   this.host.position.moveTowards(
    //     mouse.position,
    //     0.08 * update.deltaMilliseconds,
    //   );
    // }

    if (keyboard.isDown('KeyW')) {
      this.host.position.moveInDirection(
        angle,
        0.08 * update.deltaMilliseconds,
      );
    }

    if (keyboard.isDown('KeyS')) {
      this.host.position.moveInDirection(
        angle + Math.PI,
        0.08 * update.deltaMilliseconds,
      );
    }

    if (keyboard.isDown('KeyA')) {
      this.host.position.moveInDirection(
        angle - Math.PI / 2,
        0.08 * update.deltaMilliseconds,
      );
    }

    if (keyboard.isDown('KeyD')) {
      this.host.position.moveInDirection(
        angle + Math.PI / 2,
        0.08 * update.deltaMilliseconds,
      );
    }

    this.host.rotation = angle;

    if (
      mouse.buttons.left &&
      this._fireCooldown.decrement(update.deltaMilliseconds).isLapsed
    ) {
      const bullet = this.world.createFromPrefab(
        BulletPrefab,
        this.host.position,
      );
      bullet.rotation = angle;

      this._fireCooldown.reset();
    }
  }
}
