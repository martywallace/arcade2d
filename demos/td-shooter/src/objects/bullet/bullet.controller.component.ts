import type { WorldObjectComponent, WorldUpdate } from '@arcade2d/engine';
import { PolygonGraphics, WorldObject, WorldTimer } from '@arcade2d/engine';

/**
 * Bullet controller has nothing to resolve from the host or world: it
 * navigates and self-destructs using only its own state and the host's
 * transform. The spawning {@link PlayerController} writes the bullet's
 * facing into `host.rotation` immediately after `world.createFromPrefab`
 * returns; from there the bullet's own movement and the graphics
 * component's transform sync both read from `host.rotation` directly —
 * no manual cross-component plumbing.
 */
export class BulletController implements WorldObjectComponent {
  private readonly _lifetime = new WorldTimer(1000);

  constructor(public readonly host: WorldObject) {}

  onAdded() {}

  onUpdate(update: WorldUpdate) {
    this.host.position.moveInDirection(
      this.host.rotation,
      update.deltaMilliseconds * 0.8,
    );

    for (const object of this.host.world.findByTag('enemy')) {
      const body = object.getComponentByType(PolygonGraphics);

      if (body.containsWorldPoint(this.host.position)) {
        this.host.destroy();
        object.destroy();
      }
    }

    if (this._lifetime.decrement(update.deltaMilliseconds).isLapsed) {
      this.host.destroy();
    }
  }

  onDestroy() {}
}
