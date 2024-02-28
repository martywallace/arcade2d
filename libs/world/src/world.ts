import { Prefab } from './prefab';
import { Point } from '@arcade2d/geometry';
import { Update } from './update';
import { WorldObject } from './world-object';

export class World {
  private _lastUpdate = 0;
  private _objects: WorldObject[] = [];

  public create(prefab: Prefab, position?: Point): WorldObject {
    const object = prefab.buildObject(this, position ?? new Point());

    this._objects.push(object);

    return object;
  }

  public update(): Update {
    const update = new Update(this._lastUpdate, Date.now());

    // Update all objects.
    for (const object of this._objects) {
      object.update(update);
    }

    for (const object of this._objects) {
      if (object.destroyed) {
        object.destroyComponents();
      }
    }

    // Remove deleted ones.
    this._objects = this._objects.filter((object) => !object.destroyed);
    this._lastUpdate = Date.now();

    return update;
  }
}
