import { Point } from '../geometry';
import { AbstractComponentHost } from './components';
import { Update } from './update';
import { World } from './world';

export type WorldObjectMetadata = {
  /**
   * A globally unique identified assigned to this object. Factors in the prefab
   * the object was created from.
   */
  readonly id: string;

  /**
   * The name of the prefab that was used to create this object. Undefined
   * indicates the object was not created from a prefab.
   */
  readonly prefabName?: string;
};

/**
 * The core object that exists within a `World` - its behaviour and
 * functionality defined by its `Component`s. Every `WorldObject` has its own
 * virtual position within a world but otherwise has no engine-defined
 * characteristics - that is up to you!
 */
export class WorldObject extends AbstractComponentHost<WorldObject> {
  private _destroyed = false;

  constructor(
    /**
     * The world that the object exists within.
     */
    public readonly world: World,

    /**
     * The virtual position of the object in the world, expressed in 2D space.
     */
    public readonly position: Point,

    /**
     * Metadata about the object and its relationship with the world is is part
     * of.
     */
    public readonly metadata: WorldObjectMetadata,
  ) {
    super();
  }

  /**
   * Lifecycle hook called when this object is actually removed from the world.
   */
  public onDestroy(): void {
    this.removeAllComponents();
  }

  public onUpdate(update: Update): void {
    for (const [_, component] of this.components) {
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

  /**
   * Whether this object has been marked as destroyed. If `true`, the object
   * will be removed from the world after the next update step.
   */
  public get destroyed(): boolean {
    return this._destroyed;
  }

  public getHostReference(): WorldObject {
    return this;
  }
}
