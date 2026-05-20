import { AbstractComponentHost, Component } from '../components';
import { Point } from '../geometry';
import { WorldObjectComponentDependencyResolver } from './dependencies';
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
 * A single addressable thing inside a {@link World}. A `WorldObject` is a
 * spatial node that hosts {@link Component}s — controllers, visuals,
 * colliders, audio sources, anything else — and provides them with a
 * canonical, shared **transform** (position, rotation, scale) that they all
 * read from or write into.
 *
 * The behaviour and appearance of an object is defined by its components.
 * The transform fields, by contrast, are owned by the host: there is one
 * position, one rotation, and one scale per object, regardless of how many
 * components reference them. This is the engine's answer to the "ten
 * components agreeing about where the thing is" coordination problem —
 * authoritative state lives on the host, and components are either:
 *
 * - **Projections of the host transform** — a `SimpleGraphics` reading
 *   `host.position` / `host.rotation` / `host.scale` in its `onUpdate` and
 *   pushing them to its underlying PIXI display object. A collider reading
 *   the same fields to transform its local shape into world space.
 * - **Writers of the host transform** — controllers and AI setting
 *   `host.rotation` to face a target, dynamic physics writing back simulated
 *   results in `onPostUpdate`.
 *
 * Pick one role per component. Mixing both — having two components fight
 * over `host.rotation` in the same phase, for instance — is exactly the
 * coordination bug the host-owned transform exists to prevent. If two
 * systems both need to author rotation, decide who owns it and have the
 * other read.
 *
 * ### Lifecycle
 *
 * An object has three internal states: `live` (in the world, ticking),
 * `marked` ({@link WorldObject.destroy} has been called, awaiting the
 * world's sweep at the end of the current/next tick), and `cleaned`
 * (`onDestroy` has fired, the object is inert). Transitions are one-way and
 * the API is idempotent — calling `destroy()` repeatedly or on an
 * already-cleaned object is safe.
 *
 * ### Enabling and disabling
 *
 * Setting {@link AbstractComponentHost.enabled} to `false` on an object
 * gates all three of its per-frame component phases (`onPreUpdate`,
 * `onUpdate`, `onPostUpdate`) at a single early-return: a paused enemy, a
 * frozen UI widget, a temporarily-disabled debug overlay. The object keeps
 * its components and their state; flip `enabled` back to `true` and it
 * resumes ticking from where it was. `onAdded` and `onDestroy` are not
 * gated — a half-attached or half-destroyed object would be worse than a
 * paused one.
 *
 * @example
 * ```typescript
 * // A controller sets the host's rotation; the graphics component reads
 * // it back out in the same tick (no coupling between the two).
 * class ChaseAI implements WorldObjectComponent {
 *   constructor(public readonly host: WorldObject) {}
 *
 *   onAdded() {}
 *
 *   onUpdate() {
 *     const target = this.host.world.findOneByTag('player');
 *     if (target) {
 *       this.host.rotation = this.host.position.angleTo(target.position);
 *     }
 *   }
 *
 *   onDestroy() {}
 * }
 * ```
 */
export class WorldObject extends AbstractComponentHost<WorldObject> {
  private _lifecycle: WorldObjectLifecycle = 'live';

  /**
   * The object's position in world space, in pixels. Cloned from the value
   * passed to the constructor so external mutations of that input cannot
   * leak in; the `Point` exposed here is mutable and intended to be written
   * by controllers / physics / movement code (`host.position.x += dx`).
   */
  public readonly position: Point;

  /**
   * The object's rotation in world space, in radians, measured clockwise
   * from the positive x-axis (i.e. `0` faces right, matching the convention
   * used by {@link Point.angular} and {@link Point.angleTo}). Mutable —
   * controllers, AI and physics write into this directly; visual components
   * read it back to orient themselves.
   *
   * Defaults to `0` (facing right) for newly-constructed objects. The
   * engine does not normalise the value, so callers may freely accumulate
   * angles past `2π` if that simplifies their logic.
   */
  public rotation: number;

  /**
   * The object's scale, expressed as a 2D `Point` so x and y can be scaled
   * independently. Defaults to `1,1` (no scaling). The exposed `Point` is
   * mutable in place — `host.scale.x = 2` works — and components projecting
   * from the host transform are expected to honour both axes.
   *
   * Like {@link WorldObject.position}, scale is *cloned* from the value
   * passed to the constructor so the inbound point can be safely reused or
   * mutated by the caller without affecting this object.
   */
  public readonly scale: Point;

  constructor(
    /**
     * The world that the object exists within.
     */
    public readonly world: World,

    /**
     * The virtual position of the object in the world, expressed in 2D space.
     * Cloned on construction.
     */
    position: Point,

    /**
     * Metadata about the object and its relationship with the world it is part
     * of.
     */
    public readonly metadata: WorldObjectMetadata,

    /**
     * Optional starting rotation in radians. Defaults to `0`.
     */
    rotation = 0,

    /**
     * Optional starting scale, as a `Point` whose `x` and `y` scale the
     * object's local axes independently. Cloned on construction. Defaults
     * to `1,1` (no scaling).
     */
    scale: Point = new Point(1, 1),
  ) {
    super();

    this.position = position.clone();
    this.rotation = rotation;
    this.scale = scale.clone();
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

  /**
   * Drives the `onPreUpdate` phase across this object's components. Called
   * by the {@link World} during the pre-update pass of each tick. Skips
   * components whose `enabled` is explicitly `false`, and components that
   * do not implement the optional hook.
   */
  public onPreUpdate(update: Update): void {
    this._runComponentPhase('onPreUpdate', 'component-pre-update', update);
  }

  /**
   * Drives the `onUpdate` phase across this object's components. Called by
   * the {@link World} during the main update pass of each tick. Skips
   * components whose `enabled` is explicitly `false`.
   */
  public onUpdate(update: Update): void {
    this._runComponentPhase('onUpdate', 'component-update', update);
  }

  /**
   * Drives the `onPostUpdate` phase across this object's components.
   * Called by the {@link World} during the post-update pass of each tick.
   * Skips components whose `enabled` is explicitly `false`, and components
   * that do not implement the optional hook.
   */
  public onPostUpdate(update: Update): void {
    this._runComponentPhase('onPostUpdate', 'component-post-update', update);
  }

  /**
   * Iterates this object's components and invokes the named phase method
   * on each. Each component is isolated in its own try/catch so one
   * throwing component does not kill the rest of this object's frame, nor
   * the wider world tick. Disabled components and components that do not
   * implement the optional hook are skipped at a single property read.
   *
   * A host-level {@link AbstractComponentHost.enabled} of `false` short-
   * circuits the whole phase before any component is touched, so disabling
   * an object is a single-check gate rather than per-component bookkeeping.
   *
   * @param method The phase method to invoke.
   * @param errorPhase The error-reporting label to attach to any thrown
   * errors during this phase.
   * @param update The `Update` instance for this tick.
   */
  private _runComponentPhase(
    method: 'onPreUpdate' | 'onUpdate' | 'onPostUpdate',
    errorPhase:
      | 'component-pre-update'
      | 'component-update'
      | 'component-post-update',
    update: Update,
  ): void {
    if (!this.enabled) {
      return;
    }

    for (const [key, component] of this.components) {
      if (component.enabled === false) {
        continue;
      }

      const hook = component[method];

      if (!hook) {
        continue;
      }

      const deps = this._getDepsFor(component);

      try {
        hook.call(component, update, deps);
      } catch (error) {
        this.world.reportError({
          phase: errorPhase,
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

  protected override _createDependencyResolver(
    component: Component<WorldObject>,
    key: string,
  ): WorldObjectComponentDependencyResolver {
    return new WorldObjectComponentDependencyResolver(this, component, key);
  }
}
