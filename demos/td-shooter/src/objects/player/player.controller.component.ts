import type { WorldObjectComponent, WorldUpdate } from '@arcade2d/engine';
import { WorldObject, WorldTimer } from '@arcade2d/engine';
import { BulletPrefab } from '../bullet/bullet.prefab';

/**
 * The player has no resolveDependencies — mouse input comes through the
 * world-level `world.getMouseState()` accessor (which forwards to the
 * auto-registered input sampler), and facing is written into
 * `host.rotation` where the graphics component reads it back during its
 * own `onPostUpdate`. No direct sibling or cross-tier component reference
 * is needed.
 */
export class PlayerController implements WorldObjectComponent {
  private readonly _fireCooldown = new WorldTimer(100);

  constructor(public readonly host: WorldObject) {}

  onAdded() {
    console.log(`Added player controller to ${this.host.metadata.id}`);
  }

  onUpdate(update: WorldUpdate) {
    const mouse = this.host.world.getMouseState();
    const angle = this.host.position.angleTo(mouse.position);

    if (mouse.position.distanceTo(this.host.position) > 10) {
      this.host.position.moveTowards(
        mouse.position,
        0.08 * update.deltaMilliseconds,
      );
    }

    this.host.rotation = angle;
    // this.host.world.camera.rotation += 0.01;

    if (
      mouse.buttons.left &&
      this._fireCooldown.decrement(update.deltaMilliseconds).isLapsed
    ) {
      const bullet = this.host.world.createFromPrefab(
        BulletPrefab,
        this.host.position,
      );
      bullet.rotation = angle;

      this._fireCooldown.reset();
    }
  }

  onDestroy() {}
}
