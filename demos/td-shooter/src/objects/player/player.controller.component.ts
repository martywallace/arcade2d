import type {
  Update,
  WorldObjectComponent,
  WorldObjectDependencyResolver,
} from '@arcade2d/engine';
import { Scene, WorldObject, WorldTimer } from '@arcade2d/engine';
import { BulletPrefab } from '../bullet/bullet.prefab';

/**
 * Dependencies declared by {@link PlayerController}. The player only needs
 * to reach across to the world-scoped {@link Scene} so it can read the
 * mouse position — facing is written into `host.rotation`, which the
 * graphics component reads back in its own `onPostUpdate`, so there is no
 * direct sibling reference here at all.
 */
type PlayerDeps = {
  readonly scene: Scene;
};

export class PlayerController implements WorldObjectComponent<PlayerDeps> {
  private readonly _fireCooldown = new WorldTimer(100);

  constructor(public readonly host: WorldObject) {}

  resolveDependencies(resolver: WorldObjectDependencyResolver): PlayerDeps {
    return {
      scene: resolver.requireFromWorld(Scene),
    };
  }

  onAdded() {
    console.log(`Added player controller to ${this.host.metadata.id}`);
  }

  onUpdate(update: Update, { scene }: PlayerDeps) {
    const mouse = scene.getMousePosition();
    const angle = this.host.position.angleTo(mouse);

    if (mouse.distanceTo(this.host.position) > 10) {
      this.host.position.moveTowards(mouse, 0.08 * update.delta);
    }

    this.host.rotation = angle;

    if (this._fireCooldown.decrement(update.delta).isLapsed) {
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
