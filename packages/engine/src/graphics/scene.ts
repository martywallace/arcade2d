import { Application, Container } from 'pixi.js';
import {
  Camera,
  World,
  WorldComponent,
  WorldDependencyResolver,
} from '../world';

type SceneDeps = {
  readonly camera: Camera;
};

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
 * ## Camera-driven framing
 *
 * `Scene` is the renderer-aware half of the engine's camera system. It
 * declares a sibling dependency on the auto-attached {@link Camera} and,
 * during {@link Scene.onPostUpdate}, applies the camera's *inverse*
 * transform to the underlying container via Pixi's `pivot`:
 *
 * - The container's pivot is set to the camera's world-space position, so
 *   that world point becomes the container's rotation/origin anchor.
 * - The container is positioned at the centre of the application's screen,
 *   so the pivoted world point lands in the middle of the canvas.
 * - The container's rotation is set to the negated camera rotation, so
 *   increasing {@link Camera.rotation} spins the world clockwise beneath a
 *   stationary viewer.
 *
 * With the default camera (`position = (0, 0)`, `rotation = 0`), the
 * world's origin appears at the centre of the canvas and the world's axes
 * line up with the canvas's. Moving the camera is the only supported way
 * to change framing; child graphics components continue to push their host
 * positions into local display objects without any awareness of the
 * camera.
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
 *
 * // The auto-attached camera makes "follow the player" a one-liner.
 * world.camera.position.copyFrom(player.position);
 * ```
 */
export class Scene implements WorldComponent<SceneDeps> {
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

  public resolveDependencies(resolver: WorldDependencyResolver): SceneDeps {
    return {
      camera: resolver.requireSibling(Camera),
    };
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

  public onAdded(): void {
    this._app.stage.addChild(this._container);
  }

  public onUpdate(): void {
    // Scene has no per-frame work of its own — child display objects update
    // via their own components, and camera-driven framing happens in
    // `onPostUpdate` so it observes a settled tick.
  }

  /**
   * Reads the auto-attached {@link Camera}'s state and applies its inverse
   * transform to the underlying Pixi container. Runs in the post-update
   * phase so any camera mutation made during `onUpdate` (a follow
   * controller writing `camera.position = player.position`, for example) is
   * already settled by the time the scene re-frames.
   */
  public onPostUpdate(_update: unknown, { camera }: SceneDeps): void {
    const screen = this._app.screen;

    // pivot in the container's local coords — i.e. world space — followed by
    // moving the container so the pivot lands at the canvas centre. This
    // is the standard 2D "look-at" idiom and keeps rotation centred on the
    // camera's position automatically.
    this._container.pivot.set(camera.position.x, camera.position.y);
    this._container.position.set(screen.width / 2, screen.height / 2);
    this._container.rotation = -camera.rotation;
  }

  public onDestroy(): void {
    this._app.stage.removeChild(this._container);
  }
}
