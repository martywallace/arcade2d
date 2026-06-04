import { AbstractComponentHost } from '../abstract-component-host';
import type { Component } from '../components.types';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { Matrix, Point, PointPrimitive } from '../geometry';
import { World } from './world';
import { WorldObjectComponentDependencyResolver } from './world-object-component-dependency-resolver';
import type {
  SetParentOptions,
  WorldObjectMetadata,
} from './world-object.types';
import { WorldUpdate } from './world-update';

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
 * - **Projections of the host transform** — a {@link PolygonGraphics}
 *   reading `host.position` / `host.rotation` / `host.scale` and pushing
 *   them to its underlying PIXI display object once per frame. A collider
 *   reading the same fields to transform its local shape into world space.
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
 * ### The transform hierarchy
 *
 * Objects form a **tree**. Every object may have one {@link WorldObject.parent}
 * and any number of {@link WorldObject.children}, established with
 * {@link WorldObject.setParent} (or the {@link WorldObject.addChild} /
 * {@link WorldObject.removeChild} conveniences). The tree exists so that
 * moving, rotating, or scaling a parent carries its descendants with it — a
 * turret rotating with its tank, a health bar tracking the unit beneath it,
 * a whole UI panel sliding on one tween.
 *
 * This splits the transform into two readings:
 *
 * - **Local** — the `position` / `rotation` / `scale` fields below are
 *   measured *relative to the parent*. They are what you set. For a **root**
 *   object (no parent) local space *is* world space, so these fields read as
 *   absolute — which is exactly how every object behaved before hierarchy
 *   existed, and why a flat game needs to know nothing about any of this.
 * - **World** — the absolute transform after composing every ancestor's
 *   transform down the chain, exposed read-only via
 *   {@link WorldObject.worldPosition}, {@link WorldObject.worldRotation},
 *   {@link WorldObject.worldScale}, and the full {@link WorldObject.worldMatrix}.
 *   This is what renderers, colliders, and "where actually is it" queries
 *   read. It is derived on demand by walking to the root, so it always
 *   reflects the latest local edits with no resolve step to remember.
 *
 * A parent rotating its children *around the parent's origin*, nested to any
 * depth, falls straight out of that composition — there is no special case
 * for depth, and {@link WorldObject.localToWorld} /
 * {@link WorldObject.worldToLocal} thread the same ancestry so a parented
 * object's collision shape transforms correctly too.
 *
 * Destroying a parent destroys its whole subtree (see *Lifecycle* below):
 * children never outlive the object they are pinned to.
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
   * The object's position **relative to its {@link WorldObject.parent}**, in
   * pixels — or in world space when the object has no parent. Constructed
   * fresh from the value passed to the constructor so external mutations of
   * that input cannot leak in; the `Point` exposed here is mutable and
   * intended to be written by controllers / physics / movement code
   * (`host.position.x += dx`). For the absolute, ancestry-composed position,
   * read {@link WorldObject.worldPosition}.
   */
  public readonly position: Point;

  /**
   * The object's rotation **relative to its {@link WorldObject.parent}**, in
   * radians, measured clockwise from the positive x-axis (i.e. `0` faces
   * right, matching the convention used by {@link Point.angular} and
   * {@link Point.angleTo}). Mutable — controllers, AI and physics write into
   * this directly; visual components read it back to orient themselves. With
   * no parent this is the object's world rotation; otherwise read
   * {@link WorldObject.worldRotation} for the composed value.
   *
   * Defaults to `0` (facing right) for newly-constructed objects. The
   * engine does not normalise the value, so callers may freely accumulate
   * angles past `2π` if that simplifies their logic.
   */
  public rotation: number;

  /**
   * The object's scale **relative to its {@link WorldObject.parent}**,
   * expressed as a 2D `Point` so x and y can be scaled independently.
   * Defaults to `1,1` (no scaling). The exposed `Point` is mutable in place —
   * `host.scale.x = 2` works — and components projecting from the host
   * transform are expected to honour both axes. For the ancestry-composed
   * scale, read {@link WorldObject.worldScale}.
   *
   * Like {@link WorldObject.position}, scale is *cloned* from the value
   * passed to the constructor so the inbound point can be safely reused or
   * mutated by the caller without affecting this object.
   */
  public readonly scale: Point;

  /**
   * The object's parent in the transform hierarchy, or `null` when it is a
   * root. Set through {@link WorldObject.setParent} — never assign this
   * directly, as the engine keeps the parent's {@link WorldObject.children}
   * list and this field in sync. See the class docblock's *transform
   * hierarchy* section for what parenting means.
   */
  private _parent: WorldObject | null = null;

  // Mutated only via setParent (on this object and on the parent whose
  // children list must stay consistent with the _parent back-pointers).
  private _children: WorldObject[] = [];

  constructor(
    /**
     * The world that the object exists within.
     */
    public readonly world: World,

    /**
     * The virtual position of the object in the world, expressed in 2D space.
     * Accepted as any {@link PointPrimitive} — a plain `{ x, y }` literal is
     * fine — and copied into a fresh internal {@link Point} on construction
     * so subsequent mutations of the input do not leak into this object.
     */
    position: PointPrimitive,

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

    this.position = new Point(position.x, position.y);
    this.rotation = rotation;
    this.scale = scale.clone();
  }

  /**
   * This object's {@link WorldObject.parent} in the transform hierarchy, or
   * `null` when it is a root. Reassign with {@link WorldObject.setParent}.
   */
  public get parent(): WorldObject | null {
    return this._parent;
  }

  /**
   * This object's direct children in the transform hierarchy, in the order
   * they were parented. The returned array is a **live, read-only view** of
   * the engine's internal list — do not mutate it; add and remove children
   * through {@link WorldObject.setParent} / {@link WorldObject.addChild} /
   * {@link WorldObject.removeChild}, which keep the parent/child links
   * consistent on both sides.
   */
  public get children(): readonly WorldObject[] {
    return this._children;
  }

  /**
   * This object's **local** transform as a single {@link Matrix} — the
   * composition of its {@link WorldObject.position},
   * {@link WorldObject.rotation}, and {@link WorldObject.scale}, measured
   * relative to its parent. Allocated fresh per call.
   *
   * Most game code wants {@link WorldObject.worldMatrix} (the absolute
   * transform); this is exposed for the rarer cases that need the
   * parent-relative matrix on its own.
   */
  public get localMatrix(): Matrix {
    return Matrix.compose(this.position, this.rotation, this.scale);
  }

  /**
   * This object's fully-resolved **world** transform as a {@link Matrix} —
   * every ancestor's transform composed down to this node, top of the tree
   * first. For a root object this equals {@link WorldObject.localMatrix}.
   *
   * Computed on demand by walking to the root, so it always reflects the
   * latest edits to any ancestor's local transform with no separate resolve
   * pass to keep in sync. This is the canonical thing a renderer or collider
   * reads to place the object in the world, and the only representation that
   * survives a rotation composed with a non-uniform parent scale (which
   * produces shear that {@link WorldObject.worldScale} cannot express).
   * Allocated fresh per call.
   */
  public get worldMatrix(): Matrix {
    const local = this.localMatrix;

    // parent.worldMatrix is freshly allocated, so appending into it in place
    // is safe and avoids an extra clone. world = parent.world × local.
    return this._parent ? this._parent.worldMatrix.append(local) : local;
  }

  /**
   * This object's absolute position in world space — the origin of its local
   * space mapped all the way up through its ancestry. For a root object this
   * equals {@link WorldObject.position}. Allocated fresh per call.
   *
   * Read this (not `position`) whenever you need to know where an object
   * *actually* is on screen — e.g. a camera following a parented unit, or
   * measuring the distance between two objects in different subtrees.
   */
  public get worldPosition(): Point {
    const { tx, ty } = this.worldMatrix;

    return new Point(tx, ty);
  }

  /**
   * This object's absolute rotation in world space, in radians — its own
   * rotation plus every ancestor's. For a root object this equals
   * {@link WorldObject.rotation}.
   *
   * Recovered from {@link WorldObject.worldMatrix}, so under a parent that
   * combines rotation with non-uniform scale (a sheared transform) it is the
   * best-effort decomposed angle rather than an exact one — see
   * {@link Matrix.decompose}.
   */
  public get worldRotation(): number {
    return this.worldMatrix.decompose().rotation;
  }

  /**
   * This object's absolute scale in world space — its own scale multiplied
   * through every ancestor's. For a root object this equals
   * {@link WorldObject.scale}. Always non-negative on both axes; see
   * {@link Matrix.decompose} for how mirrored or sheared ancestries are
   * approximated. Allocated fresh per call.
   */
  public get worldScale(): Point {
    const { scaleX, scaleY } = this.worldMatrix.decompose();

    return new Point(scaleX, scaleY);
  }

  /**
   * Re-homes this object in the transform hierarchy, making `parent` its new
   * parent (or detaching it to become a root when `parent` is `null`). The
   * parent's {@link WorldObject.children} list and this object's
   * {@link WorldObject.parent} are updated together so the two never
   * disagree.
   *
   * By default the object's **world** transform is preserved — its local
   * position/rotation/scale are recomputed so it does not visibly move (see
   * {@link SetParentOptions.keepWorldTransform} to opt out and keep the local
   * transform instead).
   *
   * @param parent The new parent, or `null` to detach to the world root.
   * @param options See {@link SetParentOptions}. Defaults to preserving the
   * world transform.
   *
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.WORLD_OBJECT_PARENT_FOREIGN} when `parent` belongs to
   *   a different {@link World}.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.WORLD_OBJECT_HIERARCHY_CYCLE} when `parent` is this
   *   object itself or one of its descendants (which would form a cycle).
   *
   * @example
   * ```typescript
   * // Pin a health bar above a unit; it now moves and rotates with it.
   * healthBar.setParent(unit);
   *
   * // Detach a power-up from the crate it was riding, leaving it exactly
   * // where it currently appears on screen.
   * powerUp.setParent(null);
   * ```
   */
  public setParent(
    parent: WorldObject | null,
    options: SetParentOptions = {},
  ): void {
    if (parent !== null) {
      if (parent.world !== this.world) {
        throwEngineError(
          ErrorCode.WORLD_OBJECT_PARENT_FOREIGN,
          'Cannot parent a world object to one in a different world.',
          { child: this.metadata.id, parent: parent.metadata.id },
        );
      }

      // Walking up from the prospective parent must never reach this object,
      // or the tree would contain a cycle (parent === this is the depth-0
      // case of the same check).
      for (
        let ancestor: WorldObject | null = parent;
        ancestor !== null;
        ancestor = ancestor._parent
      ) {
        if (ancestor === this) {
          throwEngineError(
            ErrorCode.WORLD_OBJECT_HIERARCHY_CYCLE,
            'Cannot parent a world object to itself or one of its ' +
              'descendants.',
            { child: this.metadata.id, parent: parent.metadata.id },
          );
        }
      }
    }

    if (parent === this._parent) {
      return;
    }

    const keepWorldTransform = options.keepWorldTransform ?? true;

    // Capture the world transform *before* relinking so the post-relink
    // recomputation below can reproduce it under the new parent.
    const worldBefore = keepWorldTransform ? this.worldMatrix : null;

    if (this._parent) {
      this._parent._children = this._parent._children.filter(
        (child) => child !== this,
      );
    }

    this._parent = parent;

    if (parent) {
      parent._children.push(this);
    }

    if (worldBefore) {
      // New local = (new parent's world)⁻¹ × (old world). With no new parent,
      // local space *is* world space, so the old world transform is the new
      // local transform directly.
      const local = parent
        ? parent.worldMatrix.invert().append(worldBefore)
        : worldBefore;
      const { x, y, rotation, scaleX, scaleY } = local.decompose();

      this.position.set(x, y);
      this.rotation = rotation;
      this.scale.set(scaleX, scaleY);
    }
  }

  /**
   * Attaches `child` beneath this object — the mirror of
   * {@link WorldObject.setParent}, reading naturally when the parent is what
   * you have in hand. Equivalent to `child.setParent(this, options)`, including
   * the default of preserving the child's world transform.
   *
   * @param child The object to parent beneath this one.
   * @param options See {@link SetParentOptions}.
   *
   * @throws {@link EngineError} with the same codes as
   *   {@link WorldObject.setParent}.
   */
  public addChild(child: WorldObject, options?: SetParentOptions): void {
    child.setParent(this, options);
  }

  /**
   * Detaches `child` from this object, returning it to the world root.
   * Equivalent to `child.setParent(null, options)` — but a no-op (rather than
   * a re-rooting) if `child` is not actually a child of this object, so it is
   * safe to call defensively.
   *
   * @param child The object to detach.
   * @param options See {@link SetParentOptions}. Defaults to preserving the
   * child's world transform, so it stays visually put.
   */
  public removeChild(child: WorldObject, options?: SetParentOptions): void {
    if (child._parent === this) {
      child.setParent(null, options);
    }
  }

  /**
   * Maps a point expressed in this object's **local** space into world
   * space, threading the full ancestry: the point is taken through this
   * object's own scale → rotate → translate (relative to its parent) and
   * then up through every ancestor. `(0, 0)` always maps to the host's
   * {@link WorldObject.worldPosition}, and a local point "10 units along +x"
   * lands wherever the host is facing *in the world*, scaled by the host's
   * and every ancestor's scale. For a root object this is just the host's
   * own scale → rotate → translate.
   *
   * Pairs with {@link WorldObject.worldToLocal} — round-tripping a point
   * through both methods is the identity (modulo floating-point error).
   *
   * Allocates a fresh {@link Point} per call so callers can mutate the
   * result without affecting host state.
   *
   * @param point The point to convert, in the host's local space.
   * @returns A new {@link Point} expressing the same location in world
   * space.
   */
  public localToWorld(point: PointPrimitive): Point {
    const result = new Point(point.x * this.scale.x, point.y * this.scale.y);

    if (this.rotation !== 0) {
      result.rotate(this.rotation);
    }

    result.add(this.position);

    // Map the parent-relative result the rest of the way up to the root.
    return this._parent ? this._parent.localToWorld(result) : result;
  }

  /**
   * Maps a point expressed in **world** space into this object's local
   * coordinate system — the inverse of {@link WorldObject.localToWorld},
   * threading the full ancestry in reverse (root-ward ancestors first, then
   * this object). This is the primitive that hit-tests and other
   * shape-vs-world queries are built on: convert the world point to local,
   * then ask the local-space shape (a {@link Polygon}, a {@link Circle}, ...)
   * whether it contains it — and because it accounts for ancestry, the query
   * is correct even for a parented object whose shape is defined in local
   * space.
   *
   * Axes with zero {@link WorldObject.scale} are left untouched on that
   * axis (rather than dividing by zero); a fully zero-scaled object
   * collapses to a point and containment against it is undefined either
   * way, so this is just the cheaper of two equally-degenerate
   * behaviours.
   *
   * Allocates a fresh {@link Point} per call.
   *
   * @param point The point to convert, in world space.
   * @returns A new {@link Point} expressing the same location in the
   * host's local space.
   */
  public worldToLocal(point: PointPrimitive): Point {
    // Bring the point down into this object's parent space first, so the
    // local untransform below is applied in the right frame.
    const inParentSpace = this._parent
      ? this._parent.worldToLocal(point)
      : point;

    const result = new Point(
      inParentSpace.x - this.position.x,
      inParentSpace.y - this.position.y,
    );

    if (this.rotation !== 0) {
      result.rotate(-this.rotation);
    }

    if (this.scale.x !== 0) {
      result.x = result.x / this.scale.x;
    }

    if (this.scale.y !== 0) {
      result.y = result.y / this.scale.y;
    }

    return result;
  }

  /**
   * Lifecycle hook called when this object is actually removed from the world.
   * Idempotent — repeat invocations are no-ops, so callers can fire it
   * defensively without worrying about double-cleanup of components.
   *
   * Detaches the object from its parent so the parent's
   * {@link WorldObject.children} list never holds a cleaned object. Children
   * of *this* object are not touched here: {@link WorldObject.destroy}
   * already marked the whole subtree, so each child receives its own
   * `onDestroy` (and detaches itself) during the same world sweep.
   */
  public onDestroy(): void {
    if (this._lifecycle === 'cleaned') {
      return;
    }

    this._lifecycle = 'cleaned';

    if (this._parent) {
      this._parent._children = this._parent._children.filter(
        (child) => child !== this,
      );
      this._parent = null;
    }

    this.removeAllComponents();
  }

  /**
   * Drives the `onPreUpdate` phase across this object's components. Called
   * by the {@link World} during the pre-update pass of each tick. Skips
   * components whose `enabled` is explicitly `false`, and components that
   * do not implement the optional hook.
   */
  public onPreUpdate(update: WorldUpdate): void {
    this._runComponentPhase('onPreUpdate', 'component-pre-update', update);
  }

  /**
   * Drives the `onUpdate` phase across this object's components. Called by
   * the {@link World} during the main update pass of each tick. Skips
   * components whose `enabled` is explicitly `false`.
   */
  public onUpdate(update: WorldUpdate): void {
    this._runComponentPhase('onUpdate', 'component-update', update);
  }

  /**
   * Drives the `onPostUpdate` phase across this object's components.
   * Called by the {@link World} during the post-update pass of each tick.
   * Skips components whose `enabled` is explicitly `false`, and components
   * that do not implement the optional hook.
   */
  public onPostUpdate(update: WorldUpdate): void {
    this._runComponentPhase('onPostUpdate', 'component-post-update', update);
  }

  /**
   * Routes an update-phase throw from one of this object's components to the
   * parent {@link World}'s error channel — a {@link WorldObject} has no
   * reporter of its own, so it delegates. The shared per-component dispatch
   * loop in {@link AbstractComponentHost} calls this; the symmetric
   * {@link WorldObject._handleComponentDestroyError} handles `onDestroy`.
   */
  protected override _reportPhaseError(
    error: unknown,
    key: string,
    errorPhase:
      | 'component-pre-update'
      | 'component-update'
      | 'component-post-update',
  ): void {
    this.world.reportError({
      phase: errorPhase,
      error,
      host: this,
      componentKey: key,
    });
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
   *
   * Destruction **cascades to the subtree**: every {@link WorldObject.children
   * descendant} is marked too, so a child can never outlive the parent it is
   * pinned to. Each marked object is swept (and has its `onDestroy` run)
   * independently by the world, honouring the same deferred timing.
   */
  public destroy(): void {
    if (this._lifecycle === 'live') {
      this._lifecycle = 'marked';

      for (const child of this._children) {
        child.destroy();
      }
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
