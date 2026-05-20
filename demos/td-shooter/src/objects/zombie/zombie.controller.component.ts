import type {
  Update,
  WorldObjectComponent,
  WorldObjectDependencyResolver,
} from '@arcade2d/engine';
import { Point, SimpleGraphics, WorldObject } from '@arcade2d/engine';
import { ZombiePrefab } from './zombie.prefab';

/**
 * The zombie only needs to talk to its own visual representation —
 * a sibling on the same {@link WorldObject}. No cross-tier dependency.
 */
type ZombieDeps = {
  readonly graphics: SimpleGraphics;
};

export class ZombieController implements WorldObjectComponent<ZombieDeps> {
  constructor(public readonly host: WorldObject) {}

  resolveDependencies(resolver: WorldObjectDependencyResolver): ZombieDeps {
    return { graphics: resolver.requireSibling(SimpleGraphics) };
  }

  onAdded() {}

  onUpdate(update: Update, { graphics }: ZombieDeps) {
    const player = this.host.world.findOneByTag('player');

    if (player) {
      if (this.host.position.distanceTo(player.position) > 10) {
        this.host.position.moveTowards(player.position, update.delta * 0.05);
      } else {
        // Destroy this zombie.
        this.host.destroy();

        // Create a new one.
        this.host.world.createFromPrefab(
          ZombiePrefab,
          new Point(Math.random() * 1000, Math.random() * 1000),
        );
      }

      graphics.rotation = this.host.position.angleTo(player.position);
    }
  }

  onDestroy() {}
}
