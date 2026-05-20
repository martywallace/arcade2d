import type {
  Update,
  WorldObjectComponent,
  WorldObjectDependencyResolver,
} from '@arcade2d/engine';
import { Scene, SimpleGraphics, WorldObject } from '@arcade2d/engine';
import { BulletController } from '../bullet/bullet.controller.component';
import { BulletPrefab } from '../bullet/bullet.prefab';

/**
 * Dependencies declared by {@link PlayerController}. Resolved once when
 * the component is added; the engine threads the same reference into
 * every lifecycle hook for the remainder of the component's life.
 *
 * - `scene` lives on the {@link World} (it's the PIXI-backed scene root,
 *   shared by every object), so it's pulled via `requireFromWorld`.
 * - `graphics` is the player's own visual representation, registered as a
 *   sibling on the same {@link WorldObject}, so it's pulled via
 *   `requireSibling`.
 */
type PlayerDeps = {
  readonly scene: Scene;
  readonly graphics: SimpleGraphics;
};

export class PlayerController implements WorldObjectComponent<PlayerDeps> {
  private _counter = 0;

  constructor(public readonly host: WorldObject) {}

  resolveDependencies(resolver: WorldObjectDependencyResolver): PlayerDeps {
    return {
      scene: resolver.requireFromWorld(Scene),
      graphics: resolver.requireSibling(SimpleGraphics),
    };
  }

  onAdded() {
    console.log(`Added player controller to ${this.host.metadata.id}`);
  }

  onUpdate(update: Update, { scene, graphics }: PlayerDeps) {
    const mouse = scene.getMousePosition();
    const angle = this.host.position.angleTo(mouse);

    if (mouse.distanceTo(this.host.position) > 10) {
      this.host.position.moveTowards(mouse, 0.08 * update.delta);
    }

    graphics.rotation = angle;

    this._counter += update.delta;

    if (this._counter > 250) {
      const bullet = this.host.world.createFromPrefab(
        BulletPrefab,
        this.host.position,
      );
      bullet.getComponent<BulletController>('controller').setAngle(angle);

      this._counter = 0;
    }
  }

  onDestroy() {}
}
