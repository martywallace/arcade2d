import type { Component, Update } from '@arcade2d/engine';
import { SimpleGraphics, WorldObject } from '@arcade2d/engine';

export class BulletController implements Component<WorldObject> {
  private _angle = 0;
  private _lifetime = 1000;

  constructor(public readonly host: WorldObject) {}

  onAdded() {}

  onUpdate(update: Update) {
    this.host.position.moveInDirection(this._angle, update.delta * 0.8);

    for (const object of this.host.world.findByTag('enemy')) {
      if (
        object
          .getComponentByType(SimpleGraphics)
          .getBounds()
          .containsPoint(this.host.position.x, this.host.position.y)
      ) {
        this.host.destroy();
        object.destroy();
      }
    }

    this._lifetime -= update.delta;

    if (this._lifetime < 0) {
      this.host.destroy();
    }
  }

  onDestroy() {}

  public setAngle(value: number) {
    this._angle = value;
    this.host.getComponentByType(SimpleGraphics).rotation = value;
  }
}
