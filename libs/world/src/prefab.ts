import { World } from './world';
import { WorldObject } from './world-object';
import { Point } from '@arcade2d/geometry';
import { Component } from './component';

export type PrefabOptions = {
  readonly name: string;
  readonly components: (
    world: World,
    object: WorldObject,
  ) => Record<string, Component>;
};

export class Prefab {
  private _lastId = 0;

  private readonly _idPrefix: string;

  constructor(private readonly options: PrefabOptions) {
    // Prefab will assign a unique prefix along with an incrementing value to
    // produce a complete ID.
    this._idPrefix =
      options.name + (Math.random() + 1).toString(36).substring(2, 5);
  }

  /**
   * Builds a new object from this prefab.
   *
   * @param world The world that the object will be added to.
   * @param position The starting position of the new object in the world.
   */
  public buildObject(world: World, position: Point): WorldObject {
    const object = new WorldObject(position, {
      id: this.generateId(),
      prefabName: this.options.name,
    });

    // Setup the components first.
    const components = Object.entries(this.options.components(world, object));

    // Make sure they are all added to the object first.
    for (const [key, component] of components) {
      object.addComponent(key, component);
    }

    // Then we can call onAdded on all of them (since they will all exist on the
    // object now).
    for (const [_, component] of components) {
      component.onAdded();
    }

    return object;
  }

  public generateId(): string {
    return this._idPrefix + ':' + (++this._lastId).toString(36);
  }
}
