import { Component } from './component';
import { Update } from './update';
import { World } from './world';
import { Point } from '../geometry';

export type WorldObjectMetadata = {
  readonly id: string;
  readonly prefabName: string;
};

export class WorldObject {
  private _destroyed = false;
  private _components = new Map<string, Component<WorldObject>>();

  constructor(
    public readonly world: World,
    public readonly position: Point,
    public readonly metadata: WorldObjectMetadata,
  ) {}

  public addComponent(
    key: string,
    component: Component<WorldObject>,
  ): Component<WorldObject> {
    // @todo: should it throw if a component already exists? Maybe the developer
    // intentionally wants to replace it and we should allow it. But I could
    // also see this being a very annoying bug to track down if it was done
    // unintentionally.

    this._components.set(key, component);

    return component;
  }

  public getComponent<T extends Component<WorldObject>>(key: string): T {
    const value = this._components.get(key);

    if (!value) {
      throw new Error(`Component not found: ${key}`);
    }

    return value as T;
  }

  public getComponentByType<T extends Component<WorldObject>>(
    type: new (owner: WorldObject) => T,
  ): T {
    for (const [_, component] of this._components) {
      if (component instanceof type) {
        return component as T;
      }
    }

    throw new Error(`Component type not found: ${type.name}`);
  }

  public getNullableComponent<T extends Component<WorldObject>>(
    key: string,
  ): T | null {
    return (this._components.get(key) ?? null) as T | null;
  }

  /**
   * Lifecycle hook called when this object is actually removed from the world.
   */
  public onDestroy(): void {
    for (const [_, component] of this._components) {
      component.onDestroy();
    }

    this._components = new Map();
  }

  public onUpdate(update: Update): void {
    for (const [_, component] of this._components) {
      component.onUpdate(update);
    }
  }

  /**
   * Marks the object as destroyed, causing it to be removed from the world
   * after the next update step. This _does not_ immediately remove it from the
   * world or destroy its components. The world _must_ be updated for those
   * steps to happen.
   */
  public destroy(): void {
    this._destroyed = true;
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }
}
