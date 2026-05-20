import { Application, Container } from 'pixi.js';
import { Component } from '../components';
import { Point } from '../geometry';
import { World } from '../world';

/**
 * The world-scoped graphics root: every {@link WorldObject}-attached
 * graphics component parents its display object to the `Scene`, and the
 * `Scene` in turn lives under the Pixi {@link Application}'s root stage.
 * Decoupling the engine's scene graph from the Pixi stage one level lets
 * the engine own framing decisions (mounting, unmounting, clearing on world
 * teardown) without dictating the rest of the application's Pixi layout.
 *
 * Wraps a Pixi `Container` internally rather than extending one. The
 * container is created in the constructor, parented to the application's
 * `stage` in {@link Scene.onAdded}, and detached again in
 * {@link Scene.onDestroy}.
 *
 * @example
 * ```ts
 * const app = new Application();
 * await app.init({ width: 800, height: 600 });
 *
 * const world = new World({
 *   components: (world) => ({
 *     scene: () => new Scene(world, app),
 *   }),
 * });
 * ```
 */
export class Scene implements Component<World> {
  private readonly _container: Container;

  /**
   * @param host The world this scene belongs to.
   * @param _app The Pixi application whose `stage` the scene mounts under.
   */
  constructor(
    public readonly host: World,
    private readonly _app: Application,
  ) {
    this._container = new Container();
  }

  /**
   * Direct access to the underlying Pixi `Container` instance.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — sorting children, custom layer ordering,
   * applying filters at the scene level, masking. Code that touches `raw`
   * is coupled to Pixi's public API and may break when:
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
  public get raw(): Container {
    return this._container;
  }

  /**
   * Adds a Pixi display object as a child of the scene. Called by
   * {@link AbstractGraphics} during `onAdded`; callers working directly
   * with Pixi (e.g. integrating an effect that isn't yet modeled as a
   * Component) can use this as a lower-friction alternative to going
   * through {@link Scene.raw}.
   *
   * @param child The Pixi display object to attach.
   */
  public addChild(child: Container): void {
    this._container.addChild(child);
  }

  /**
   * Detaches a Pixi display object from the scene. Idempotent — calling
   * with a child that isn't attached is a no-op.
   *
   * @param child The Pixi display object to detach.
   */
  public removeChild(child: Container): void {
    this._container.removeChild(child);
  }

  /**
   * Returns the current pointer position in scene-space, as an arcade2d
   * {@link Point}. Useful for hover tests, aim controllers, and any other
   * code that reads where the mouse currently is.
   */
  public getMousePosition(): Point {
    const base = this._app.renderer.events.pointer.global;

    return new Point(base.x, base.y);
  }

  public onAdded(): void {
    this._app.stage.addChild(this._container);
  }

  public onUpdate(): void {
    // Scene has no per-frame work of its own — child display objects update
    // via their own components.
  }

  public onDestroy(): void {
    this._app.stage.removeChild(this._container);
  }
}
