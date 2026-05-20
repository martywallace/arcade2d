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
 * Internal lifecycle states a {@link WorldObject} can be in. Encoded as a
 * single state field rather than a pair of booleans so that "marked" and
 * "cleaned" can never disagree.
 *
 * - `live`: in the world, eligible for `onUpdate`.
 * - `marked`: {@link WorldObject.destroy} has been called; the world will
 *   sweep this object at the end of the current/next tick.
 * - `cleaned`: {@link WorldObject.onDestroy} has run; further calls are
 *   no-ops.
 */
type WorldObjectLifecycle = 'live' | 'marked' | 'cleaned';

/**
 * The core object that exists within a `World` - its behaviour and
 * functionality defined by its `Component`s. Every `WorldObject` has its own
 * virtual position within a world but otherwise has no engine-defined
 * characteristics - that is up to you!
 */
export class WorldObject extends AbstractComponentHost<WorldObject> {
  private _lifecycle: WorldObjectLifecycle = 'live';

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
    if (this._lifecycle === 'cleaned') {
      return;
    }

    this._lifecycle = 'cleaned';
    this.removeAllComponents();
  }

  public onUpdate(update: Update): void {
    // Each component is isolated so one throwing component does not kill
    // the rest of this object's frame, nor the wider world tick.
    for (const [key, component] of this.components) {
      try {
        component.onUpdate(update);
      } catch (error) {
        this.world.reportError({
          phase: 'component-update',
          error,
          host: this,
          componentKey: key,
        });
      }
    }
  }

  protected override _handleComponentDestroyError(
    error: unknown,
    key: string,
  ): void {
    this.world.reportError({
      phase: 'component-destroy',
      error,
      host: this,
      componentKey: key,
    });
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
   *
   * Calling `destroy` on an already-marked or already-cleaned object is a
   * no-op.
   */
  public destroy(): void {
    if (this._lifecycle === 'live') {
      this._lifecycle = 'marked';
    }
  }

  /**
   * Whether this object is no longer alive — either marked for destruction
   * and awaiting the next sweep, or already cleaned up. Live objects return
   * `false`; everything else returns `true`.
   */
  public get destroyed(): boolean {
    return this._lifecycle !== 'live';
  }

  protected getHostReference(): WorldObject {
    return this;
  }
}
