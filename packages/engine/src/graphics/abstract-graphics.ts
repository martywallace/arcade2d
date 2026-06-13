import { Container, Matrix as PixiMatrix } from 'pixi.js';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { AbstractWorldObjectComponent, WorldObject } from '../world';
import type { GraphicsOptions } from './abstract-graphics.types';
import type { Layer } from './layer';
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
 * - syncing the host {@link WorldObject}'s fully-resolved **world**
 *   transform (its own position/rotation/scale composed with every
 *   ancestor's) into the display object once per frame, so the visual
 *   reflects every behavior change made during the tick and a parented
 *   object renders relative to its parent,
 * - exposing the underlying Pixi instance via {@link AbstractGraphics.raw}
 *   for advanced use cases the typed surface doesn't cover,
 * - applying and exposing the two visual properties every display object
 *   shares — {@link AbstractGraphics.alpha} and
 *   {@link AbstractGraphics.visible}.
 *
 * Subclasses provide the concrete display object — typically a Pixi
 * `Graphics` for shape-drawing components, or one of the textured display
 * objects via {@link AbstractTexturedGraphics}, which layers `anchor` and
 * `tint` on top of this base.
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
  private _layer?: Layer;

  /**
   * @param host The {@link WorldObject} this component is attached to. The
   * host's resolved {@link WorldObject.worldMatrix world transform} drives the
   * display object's transform once per frame.
   * @param display The Pixi display object to wrap. Constructed by the
   * subclass and handed up; ownership transfers to this base — it will be
   * destroyed during {@link AbstractGraphics.onDestroy}.
   * @param options The {@link GraphicsOptions} — the `alpha` and `visible`
   * every graphic shares. Subclasses widen this with their own options and
   * pass the whole bag up (defaulting it for their own callers).
   */
  constructor(host: WorldObject, display: T, options: GraphicsOptions) {
    super(host);

    this._display = display;
    this._display.alpha = options.alpha ?? 1;
    this._display.visible = options.visible ?? true;
    this._layer = options.layer;
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
    this._mount();

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
    // Detach from whatever container actually holds the display — the scene
    // root in layer-less mode, or a layer bucket otherwise — then release it.
    this._display.parent?.removeChild(this._display);
    this._display.destroy();
  }

  /**
   * The render layer this graphic is in, or `undefined` in a layer-less world.
   *
   * Assigning a different {@link Layer} re-parents the display into that layer's
   * container, moving the graphic between bands at runtime (e.g. dropping a
   * dying enemy below the living). The same opt-in rules as
   * {@link GraphicsOptions.layer} apply: a layered world rejects `undefined`
   * ({@link ErrorCode.LAYER_UNSPECIFIED}), a layer-less world rejects a token
   * ({@link ErrorCode.LAYER_SET_ABSENT}), and a foreign token is rejected by
   * {@link Scene.containerForLayer} ({@link ErrorCode.LAYER_NOT_IN_SET}).
   */
  public get layer(): Layer | undefined {
    return this._layer;
  }

  public set layer(value: Layer | undefined) {
    this._layer = value;

    // Re-home the display only once it is mounted; before onAdded there is
    // nothing parented yet, so just remember the choice for _mount to apply.
    if (this._display.parent) {
      this._display.parent.removeChild(this._display);
      this._mount();
    }
  }

  // Parents the display into the right container: a layer bucket when the
  // scene has a layer set (a layer is then mandatory), or the scene root
  // otherwise (a layer is then forbidden).
  private _mount(): void {
    if (this._scene.hasLayers) {
      if (!this._layer) {
        throwEngineError(
          ErrorCode.LAYER_UNSPECIFIED,
          'This graphic was added to a layered world but named no layer. ' +
            'Pass one via the `layer` option, e.g. ' +
            "`{ layer: layers.get('characters') }`.",
          { host: this.host },
        );
      }

      this._scene.containerForLayer(this._layer).addChild(this._display);
      return;
    }

    if (this._layer) {
      throwEngineError(
        ErrorCode.LAYER_SET_ABSENT,
        'This graphic named a layer, but its world has no layer set. Pass ' +
          '`layers` to game.createWorld, or drop the `layer` option.',
        { host: this.host },
      );
    }

    this._scene.addChild(this._display);
  }

  /**
   * Opacity from `0` (fully transparent) to `1` (fully opaque). Applies to
   * the whole graphic, including any children the display object holds.
   */
  public get alpha(): number {
    return this._display.alpha;
  }

  public set alpha(value: number) {
    this._display.alpha = value;
  }

  /**
   * Whether the graphic is drawn. A hidden graphic still ticks and stays
   * transform-synced; it is simply skipped by the renderer.
   */
  public get visible(): boolean {
    return this._display.visible;
  }

  public set visible(value: boolean) {
    this._display.visible = value;
  }

  private _syncTransform(): void {
    // Push the host's fully-resolved *world* transform, not its local one, so
    // a parented object renders composed with its ancestry — including the
    // shear a rotation-plus-non-uniform-scale chain produces, which a
    // position/rotation/scale copy could not represent. The Scene container
    // this display lives under carries the camera transform, so world space
    // is exactly the right frame to hand the renderer. For a root object the
    // world matrix is just its local transform, so this stays a faithful
    // copy of position/rotation/scale.
    const { a, b, c, d, tx, ty } = this.host.worldMatrix;

    this._display.setFromMatrix(new PixiMatrix(a, b, c, d, tx, ty));
  }
}
