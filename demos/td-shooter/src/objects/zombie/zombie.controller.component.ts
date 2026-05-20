import type { WorldObjectComponent, WorldUpdate } from '@arcade2d/engine';
import { Random, WorldObject } from '@arcade2d/engine';
import { ZombiePrefab } from './zombie.prefab';

/**
 * Zombie has no resolved dependencies — facing is written into
 * `host.rotation` and movement mutates `host.position`, both of which the
 * sibling graphics component reads back in its own `onPostUpdate`. No
 * cross-component references are needed at all.
 */
export class ZombieController implements WorldObjectComponent {
  constructor(public readonly host: WorldObject) {}

  onAdded() {}

  onUpdate(update: WorldUpdate) {
    const player = this.host.world.findOneByTag('player');

    if (player) {
      if (this.host.position.distanceTo(player.position) > 10) {
        this.host.position.moveTowards(
          player.position,
          update.deltaMilliseconds * 0.05,
        );
      } else {
        // Destroy this zombie.
        this.host.destroy();
      }

      this.host.rotation = this.host.position.angleTo(player.position);
    }
  }

  onDestroy() {
    const player = this.host.world.findOneByTag('player');

    if (player)
      // Spawn a new zombie somewhere in a ring around the player.
      // Create a new one.
      this.host.world.createFromPrefab(
        ZombiePrefab,
        new Random().inRing(player.position.x, player.position.y, 300, 500),
      );

    this.host.world.camera.shake(20, 300);
  }
}
