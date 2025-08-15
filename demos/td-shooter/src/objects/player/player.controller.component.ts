import type { Component, Update } from '@arcade2d/engine';
import { Scene, SimpleGraphics, WorldObject } from '@arcade2d/engine';
import { BulletController } from '../bullet/bullet.controller.component';
import { BulletPrefab } from '../bullet/bullet.prefab';

export class PlayerController implements Component<WorldObject> {
  private _counter = 0;

  constructor(public readonly host: WorldObject) {}

  onAdded() {
    console.log(`Added player controller to ${this.host.metadata.id}`);
  }

  onUpdate(update: Update) {
    const scene = this.host.world.getComponentByType(Scene);
    const mouse = scene.getMousePosition();
    const angle = this.host.position.angleTo(mouse);

    if (mouse.distanceTo(this.host.position) > 10) {
      this.host.position.moveTowards(mouse, 0.08 * update.delta);
    }

    this.host.getComponentByType(SimpleGraphics).rotation = angle;

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
