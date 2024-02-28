import { Point } from '@arcade2d/geometry';
import { Component } from './component';
import { Update } from './update';

export type WorldObjectMetadata = {
  readonly id: string;
  readonly prefabName: string;
};

export class WorldObject {
  private _destroyed = false;
  private _components = new Map<string, Component>();

  constructor(
    public readonly position: Point,
    public readonly metadata: WorldObjectMetadata,
  ) {}

  public addComponent(key: string, component: Component): Component {
    // @todo: should it throw if a component already exists? Maybe the developer
    // intentionally wants to replace it and we should allow it. But I could
    // also see this being a very annoying bug to track down if it was done
    // unintentionally.

    this._components.set(key, component);

    return component;
  }

  public getComponent<T extends Component>(key: string): T {
    const value = this._components.get(key);

    if (!value) {
      throw new Error(`Component not found: ${key}`);
    }

    return value as T;
  }

  public getNullableComponent<T extends Component>(key: string): T | null {
    return (this._components.get(key) ?? null) as T | null;
  }

  /**
   * Destroys all components attached to this object.
   */
  public destroyComponents(): void {
    for (const [_, component] of this._components) {
      component.onDestroyed();
    }

    this._components = new Map();
  }

  public update(update: Update): void {
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
