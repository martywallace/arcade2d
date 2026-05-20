import { Application, Container } from 'pixi.js';
import { Point } from '../geometry';
import { PointPrimitive } from '../geometry/point';
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
 * transform to the underlying container:
 *
 * - The container's pivot is set to the camera's world-space position, so
 *   that world point becomes the container's rotation/origin anchor.
 * - The container is positioned at the centre of the application's screen,
 *   plus the camera's current {@link Camera.shakeOffset} (in screen pixels),
 *   so the pivoted world point lands in the middle of the canvas — with
 *   whatever shake jitter is in flight stacked on top.
 * - The container's rotation is set to the negated camera rotation, so
 *   increasing {@link Camera.rotation} spins the world clockwise beneath a
 *   stationary viewer.
 * - The container's scale is set to the camera's {@link Camera.zoom}, so
 *   the rendered world scales with the camera, uniform on both axes.
 *
 * With the default camera (`position = (0, 0)`, `rotation = 0`, `zoom = 1`),
 * the world's origin appears at the centre of the canvas and one world
 * unit equals one screen pixel.
 *
 * ## Coordinate conversions
 *
 * {@link Scene.worldToScreen} and {@link Scene.screenToWorld} expose the
 * forward and inverse forms of the transform above. Both use the camera's
 * *logical* state (no shake offset) so that they are proper inverses of
 * each other, which is what input handling and HUD-marker placement
 * almost always want — clicking during a shake should still land on the
 * world point the player aimed at.
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

  /**
   * Converts a point in world space to canvas-local screen pixels, using
   * the camera's **logical** state (i.e. position, rotation, and zoom —
   * but not shake). Useful for placing HUD overlays that need to track a
   * world target (mission markers, damage numbers floating above an
   * enemy, etc.).
   *
   * The inverse of {@link Scene.screenToWorld}: round-tripping a point
   * through both yields the original (modulo floating-point error).
   *
   * @param world The point to convert, in world space.
   * @returns A fresh {@link Point} expressing the same location in
   * canvas-local screen pixels.
   */
  public worldToScreen(world: PointPrimitive): Point {
    const camera = this.host.camera;
    const screen = this._app.screen;
    const result = new Point(
      world.x - camera.position.x,
      world.y - camera.position.y,
    );

    if (camera.rotation !== 0) {
      result.rotate(-camera.rotation);
    }

    if (camera.zoom !== 1) {
      result.scale(camera.zoom);
    }

    return result.add(screen.width / 2, screen.height / 2);
  }

  /**
   * Converts a point in canvas-local screen pixels to world space, using
   * the camera's **logical** state. This is the primitive {@link Mouse}
   * builds on to report pointer positions in world coordinates, and
   * what game-side click handlers should generally use — clicking during a
   * camera shake should still resolve to the world point the player
   * aimed at, not a phantom shifted by the jitter.
   *
   * The inverse of {@link Scene.worldToScreen}.
   *
   * @param screen The point to convert, in canvas-local screen pixels.
   * @returns A fresh {@link Point} expressing the same location in world
   * space.
   */
  public screenToWorld(screen: PointPrimitive): Point {
    const camera = this.host.camera;
    const view = this._app.screen;
    const result = new Point(
      screen.x - view.width / 2,
      screen.y - view.height / 2,
    );

    if (camera.zoom !== 0 && camera.zoom !== 1) {
      result.scale(1 / camera.zoom);
    }

    if (camera.rotation !== 0) {
      result.rotate(camera.rotation);
    }

    return result.add(camera.position);
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
   *
   * The shake offset is added to the container's `position`, *not* the
   * pivot — Pixi applies `position` after the scale/rotation chain, so
   * the offset stays in literal screen pixels regardless of `camera.zoom`
   * and `camera.rotation`. That's what game devs intuitively want from a
   * "screen-shake of N pixels": N pixels on screen, not a value that grows
   * with zoom-in.
   */
  public onPostUpdate(_update: unknown, { camera }: SceneDeps): void {
    const screen = this._app.screen;

    this._container.pivot.set(camera.position.x, camera.position.y);
    this._container.position.set(
      screen.width / 2 + camera.shakeOffset.x,
      screen.height / 2 + camera.shakeOffset.y,
    );
    this._container.rotation = -camera.rotation;
    this._container.scale.set(camera.zoom);
  }

  public onDestroy(): void {
    this._app.stage.removeChild(this._container);
  }
}
