import { AbstractComponentHost } from '../components';
import { Point } from '../geometry';
import { Update } from './update';
import { World } from './world';

export type WorldObjectMetadata = {
  /**
   * A globally unique identified assigned to this object. Factors in the prefab
   * the object was created from.
   */
  readonly id: string;

  /**
   * A set of tags to assing to the object.
   */
  readonly tags: Set<string>;

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
  private _onDestroyCalled = false;

  public readonly position: Point;

  constructor(
    /**
     * The world that the object exists within.
     */
    public readonly world: World,

    /**
     * The virtual position of the object in the world, expressed in 2D space.
     */
    position: Point,

    /**
     * Metadata about the object and its relationship with the world is is part
     * of.
     */
    public readonly metadata: WorldObjectMetadata,
  ) {
    super();

    this.position = position.clone();
  }

  /**
   * Lifecycle hook called when this object is actually removed from the world.
   * Idempotent — repeat invocations are no-ops, so callers can fire it
   * defensively without worrying about double-cleanup of components.
   */
  public onDestroy(): void {
    if (this._onDestroyCalled) {
      return;
    }

    this._onDestroyCalled = true;
    this.removeAllComponents();
  }

  public onUpdate(update: Update): void {
    for (const [_, component] of this.components) {
      component.onUpdate(update);
    }
  }

  /**
   * Marks the object as destroyed. This _does not_ immediately remove it from
   * the world or destroy its components — the world _must_ tick at least once
   * for that to happen.
   *
   * If called during a {@link World.update} tick, the object is removed at
   * the end of that tick. If the object has not yet had its `onUpdate` called
   * during the same tick (e.g. it was destroyed by a component or by an
   * earlier object in the iteration), its `onUpdate` is skipped — destroyed
   * objects do not get one final tick.
   */
  public destroy(): void {
    this._destroyed = true;
  }

  /**
   * Whether this object has been marked as destroyed. If `true`, the object
   * will be removed from the world at the end of the current (or next)
   * {@link World.update} tick.
   */
  public get destroyed(): boolean {
    return this._destroyed;
  }

  protected getHostReference(): WorldObject {
    return this;
  }
}
