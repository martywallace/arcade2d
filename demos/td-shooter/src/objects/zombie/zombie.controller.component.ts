import type { Component, Update } from '@arcade2d/engine';
import { Point, SimpleGraphics, WorldObject } from '@arcade2d/engine';
import { ZombiePrefab } from './zombie.prefab';

export class ZombieController implements Component<WorldObject> {
  constructor(public readonly host: WorldObject) {}

  onAdded() {}

  onUpdate(update: Update) {
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

      this.host.getComponentByType(SimpleGraphics).rotation =
        this.host.position.angleTo(player.position);
    }
  }

  onDestroy() {}
}
