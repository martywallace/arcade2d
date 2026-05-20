import { Container } from 'pixi.js';
import { AbstractWorldObjectComponent, WorldObject } from '../world';
import { Scene } from './scene';

/**
 * Base class for {@link WorldObject}-attached components whose visual is a
 * Pixi display object. `AbstractGraphics` owns the boilerplate that every
 * such component needs:
 *
 * - resolving the world's {@link Scene} so the display object has somewhere
 *   to live,
 * - parenting and unparenting the display object across the component's
 *   lifecycle,
 * - syncing the host {@link WorldObject}'s transform — position, rotation,
 *   scale — into the display object once per frame so the visual reflects
 *   every behavior change made during the tick,
 * - exposing the underlying Pixi instance via {@link AbstractGraphics.raw}
 *   for advanced use cases the typed surface doesn't cover.
 *
 * Subclasses provide the concrete display object — typically a Pixi
 * `Graphics` for shape-drawing components, but the base is generic so a
 * future `SpriteGraphics extends AbstractGraphics<Sprite>` slots in without
 * special-casing.
 *
 * ### Transform-sync timing
 *
 * The host transform is copied into the display object during
 * {@link AbstractGraphics.onPostUpdate} rather than `onUpdate`. This way the
 * visual reflects every position/rotation/scale change made earlier in the
 * tick regardless of which component made it or what phase it ran in — a
 * controller's `onUpdate` move and a physics body's `onPostUpdate` snap both
 * end up on screen the same frame.
 *
 * An initial sync also runs in {@link AbstractGraphics.onAdded}, immediately
 * after the display is parented to the {@link Scene}. Without this, an object
 * spawned mid-tick (after the world's `onPostUpdate` pass) — or spawned in
 * setup code between bootstrap and the first tick — would render at Pixi's
 * default `(0, 0)` for one frame before the next tick's sync caught up,
 * producing a single-frame flicker at the origin.
 *
 * ### Lifecycle ownership
 *
 * The base parents the display object to the {@link Scene} in `onAdded` and
 * removes it in `onDestroy`. Subclasses that allocate Pixi-side resources
 * (textures, geometries) should release them by overriding `onDestroy`,
 * calling `super.onDestroy()` first.
 *
 * @template T The concrete Pixi display object this component wraps. Must
 * be a `Container` or subclass (Pixi's universal scene-graph node type).
 *
 * @example
 * ```ts
 * import { Graphics as PixiGraphics } from 'pixi.js';
 *
 * export class RingGraphics extends AbstractGraphics<PixiGraphics> {
 *   constructor(host: WorldObject, radius: number, color = 0xffffff) {
 *     const display = new PixiGraphics();
 *     display.circle(0, 0, radius).stroke({ width: 2, color });
 *     super(host, display);
 *   }
 * }
 * ```
 */
export abstract class AbstractGraphics<
  T extends Container,
> extends AbstractWorldObjectComponent {
  private readonly _display: T;
  private readonly _scene: Scene;

  /**
   * @param host The {@link WorldObject} this component is attached to. The
   * host's `position`, `rotation`, and `scale` drive the display object's
   * transform once per frame.
   * @param display The Pixi display object to wrap. Constructed by the
   * subclass and handed up; ownership transfers to this base — it will be
   * destroyed during {@link AbstractGraphics.onDestroy}.
   */
  constructor(host: WorldObject, display: T) {
    super(host);

    this._display = display;
    this._scene = host.world.getComponentByType(Scene);
  }

  /**
   * Direct access to the underlying Pixi display object.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — custom shaders, filter chains, advanced
   * blend modes, mask assignment, world-space bounds queries, anything we
   * haven't decided how to model yet. Code that touches `raw` is coupled to
   * Pixi's public API and may break when:
   *
   * - arcade2d upgrades Pixi (including minor versions).
   * - Pixi itself ships a breaking change.
   * - arcade2d swaps Pixi for a different renderer.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed methods on this component; reach for `raw`
   * only when no equivalent exists, and isolate the access behind your own
   * helper so the coupling is in one place.
   */
  public get raw(): T {
    return this._display;
  }

  public override onAdded(): void {
    this._scene.addChild(this._display);

    // Seed the display's transform from the host immediately. Spawns that
    // happen mid-tick (or between bootstrap and the first tick) would
    // otherwise render once at Pixi's default (0, 0) before the next tick's
    // onPostUpdate caught up.
    this._syncTransform();
  }

  public onPostUpdate(): void {
    this._syncTransform();
  }

  public override onDestroy(): void {
    this._scene.removeChild(this._display);
    this._display.destroy();
  }

  private _syncTransform(): void {
    this._display.x = this.host.position.x;
    this._display.y = this.host.position.y;
    this._display.rotation = this.host.rotation;
    this._display.scale.set(this.host.scale.x, this.host.scale.y);
  }
}
