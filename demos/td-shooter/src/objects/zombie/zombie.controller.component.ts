import type { WorldUpdate } from '@arcade2d/engine';
import { AbstractWorldObjectComponent, Random } from '@arcade2d/engine';
import { ZombiePrefab } from './zombie.prefab';

/**
 * Zombie has no resolved dependencies — facing is written into
 * `host.rotation` and movement mutates `host.position`, both of which the
 * sibling graphics component reads back in its own `onPostUpdate`. No
 * cross-component references are needed at all.
 */
export class ZombieController extends AbstractWorldObjectComponent {
  public override onUpdate(update: WorldUpdate): void {
    const player = this.world.findOneByTag('player');

    if (player) {
      if (this.host.position.distanceTo(player.position) > 10) {
        this.host.position.moveTowards(
          player.position,
          update.deltaMilliseconds * 0.05,
        );
      } else {
        this.host.destroy();
      }

      this.host.rotation = this.host.position.angleTo(player.position);
    }
  }

  public override onDestroy(): void {
    const player = this.world.findOneByTag('player');

    if (player) {
      // Spawn a new zombie somewhere in a ring around the player.
      this.world.createFromPrefab(
        ZombiePrefab,
        new Random().inRing(player.position.x, player.position.y, 300, 500),
      );
    }

    this.world.camera.shake(20, 300);
  }
}
