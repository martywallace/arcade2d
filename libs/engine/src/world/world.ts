import { Prefab } from './prefab';
import { Update } from './update';
import { WorldObject } from './world-object';
import { Component } from './component';
import { Point } from '../geometry';

export type WorldOptions = {
  readonly components: (world: World) => Record<string, () => Component<World>>;
};

export class World {
  private _lastUpdate = 0;
  private _objects: WorldObject[] = [];
  private _components = new Map<string, Component<World>>();

  constructor(private readonly options: WorldOptions) {
    for (const [key, factory] of Object.entries(options.components(this))) {
      this.addComponent(key, factory());
    }

    for (const [_, component] of this._components) {
      component.onAdded();
    }
  }

  public addComponent(
    key: string,
    component: Component<World>,
  ): Component<World> {
    // @todo: concerns per WorldObject.addComponent()

    this._components.set(key, component);

    return component;
  }

  public getComponent<T extends Component<World>>(key: string): T {
    const value = this._components.get(key);

    if (!value) {
      throw new Error(`Component not found: ${key}`);
    }

    return value as T;
  }

  public getComponentByType<T extends Component<World>>(
    type: new (owner: World, ...args: any[]) => T,
  ): T {
    for (const [_, component] of this._components) {
      if (component instanceof type) {
        return component as T;
      }
    }

    throw new Error(`Component type not found: ${type.name}`);
  }

  public create(prefab: Prefab, position?: Point): WorldObject {
    const object = prefab.buildObject(this, position ?? new Point());

    this._objects.push(object);

    return object;
  }

  public update(): Update {
    const update = new Update(this._lastUpdate, Date.now());

    // Update all components.
    for (const [_, component] of this._components) {
      component.onUpdate(update);
    }

    // Update all objects.
    for (const object of this._objects) {
      object.onUpdate(update);
    }

    for (const object of this._objects) {
      if (object.destroyed) {
        object.onDestroy();
      }
    }

    // Remove deleted ones.
    this._objects = this._objects.filter((object) => !object.destroyed);
    this._lastUpdate = Date.now();

    return update;
  }

  /**
   * Immediately destroys the world, all of its objects and any included
   * components.
   */
  public destroy(): void {
    for (const object of this._objects) {
      object.onDestroy();
    }

    this._objects = [];
  }
}
