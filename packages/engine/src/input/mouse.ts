import { Application } from 'pixi.js';
import { Point } from '../geometry';
import {
  Camera,
  World,
  WorldComponent,
  WorldDependencyResolver,
} from '../world';

/**
 * Per-tick snapshot of mouse state exposed by {@link World.getMouseState}.
 * Returned objects are fresh on every call — the engine intentionally
 * does **not** hand back a live reference, so a caller stashing the value
 * for a frame won't see it change mid-update.
 *
 * - {@link MouseState.position} is in **world space**, with the camera's
 *   position, rotation, (and, in future, zoom) already inverted out. Use
 *   this when comparing against a {@link WorldObject}'s `position` —
 *   "where is the cursor in the game's coordinate system?"
 * - {@link MouseState.screenPosition} is the raw canvas-local pixel
 *   position, with the canvas's top-left at `(0, 0)`. Use this for HUDs,
 *   menus, or any logic that should ignore camera framing.
 *
 * Button fields are simple "currently held" booleans. They are NOT edge-
 * triggered "just pressed" / "just released" flags; for that, components
 * should compare against last frame's state themselves.
 */
export interface MouseState {
  /**
   * Cursor position in world space. Reflects the camera's inverse transform:
   * with the default camera, this matches {@link MouseState.screenPosition}
   * shifted so the canvas centre maps to world `(0, 0)`. Moving the camera
   * shifts the world position accordingly; rotating the camera rotates the
   * world position around the camera's pivot.
   */
  readonly position: Point;

  /**
   * Cursor position in canvas-local pixels. `(0, 0)` is the canvas's
   * top-left, regardless of where the canvas sits on the page. Independent
   * of the camera.
   */
  readonly screenPosition: Point;

  /**
   * `true` while the primary (left) mouse button is held.
   */
  readonly leftButton: boolean;

  /**
   * `true` while the secondary (right) mouse button is held. The engine
   * does **not** suppress the browser's native context menu on right-click
   * — applications that want to use the right button as a game input
   * should add their own `contextmenu` listener and call
   * `event.preventDefault()`.
   */
  readonly rightButton: boolean;

  /**
   * `true` while the middle (wheel) mouse button is held.
   */
  readonly middleButton: boolean;
}

type MouseDeps = {
  readonly camera: Camera;
};

/**
 * World-scoped input sampler that tracks the canvas-local mouse position
 * and the state of the three standard buttons (left, middle, right).
 *
 * Most game code reads mouse state via the convenience accessor on the
 * world — `world.getMouseState()` — rather than touching this component
 * directly; the class itself is exported so that callers writing their own
 * bootstrap, or users who want to swap in a custom input source, have
 * something concrete to construct and register.
 *
 * ## Snapshot semantics
 *
 * The component follows the canonical "input sampler" pattern described in
 * the {@link World} docblock:
 *
 * 1. DOM events update a private *pending* buffer as they arrive — this is
 *    asynchronous and can happen at any time relative to the engine's
 *    update tick.
 * 2. {@link Mouse.onPreUpdate} copies the pending buffer into a private
 *    *snapshot* once per tick, before any other component's `onUpdate`
 *    runs.
 * 3. {@link Mouse.getState} returns a {@link MouseState} derived from the
 *    snapshot, so every component reading the mouse during a single tick
 *    sees the same screen-space position and the same button states.
 *
 * The world-space `position` field is recomputed on each `getState()` call
 * using the *current* {@link Camera} state rather than the camera's value
 * at snapshot time. This way a follow-camera that moves in `onPostUpdate`
 * still produces correct mouse-to-world coordinates for the very next
 * tick's `onUpdate` reads.
 *
 * ## Event sourcing
 *
 * Listeners are attached during {@link Mouse.onAdded} and removed in
 * {@link Mouse.onDestroy}:
 *
 * - `mousemove` and `mousedown` are listened on the canvas, so cursor
 *   tracking and press detection only fire while the pointer is over the
 *   game.
 * - `mouseup` is listened on `window`, so releases that happen *off* the
 *   canvas (after dragging the cursor off the game area) still register
 *   and clear the held-button state. Without this, the button would
 *   appear stuck-down until the user came back over the canvas and
 *   released again.
 *
 * The engine does not call `event.preventDefault()` on any of these — game
 * code is free to do that itself if it wants to suppress browser
 * defaults like right-click context menus or middle-click autoscroll.
 */
export class Mouse implements WorldComponent<MouseDeps> {
  private _pendingScreenX = 0;
  private _pendingScreenY = 0;
  private _pendingLeft = false;
  private _pendingRight = false;
  private _pendingMiddle = false;

  private readonly _snapshotScreenPosition = new Point(0, 0);
  private _snapshotLeft = false;
  private _snapshotRight = false;
  private _snapshotMiddle = false;

  // Cached at `onAdded` so `getState` doesn't have to thread deps through.
  // The camera reference is stable for the lifetime of this component
  // (World.camera is set once at construction and never reassigned).
  private _camera: Camera | null = null;

  private readonly _onMouseMove = (event: MouseEvent): void => {
    // clientX/Y are page-relative; subtract the canvas's current bounding
    // rect to land in canvas-local coordinates. `getBoundingClientRect` is
    // cheap enough on a per-mousemove cadence (browsers cache the result
    // until the next layout invalidation) and is robust to the canvas
    // being positioned anywhere on the page — including inside scrolled
    // containers and CSS-transformed layouts, where `offsetX/Y` and the
    // various older alternatives quietly disagree.
    const rect = this._app.canvas.getBoundingClientRect();

    this._pendingScreenX = event.clientX - rect.left;
    this._pendingScreenY = event.clientY - rect.top;
  };

  private readonly _onMouseDown = (event: MouseEvent): void => {
    this._writeButton(event.button, true);
  };

  private readonly _onMouseUp = (event: MouseEvent): void => {
    this._writeButton(event.button, false);
  };

  /**
   * @param host The world this mouse belongs to.
   * @param _app The Pixi {@link Application} whose `canvas` the mouse
   * listens on. Held privately rather than resolved each frame because
   * the application instance is stable for the lifetime of the world.
   */
  constructor(
    public readonly host: World,
    private readonly _app: Application,
  ) {}

  public resolveDependencies(resolver: WorldDependencyResolver): MouseDeps {
    return {
      camera: resolver.requireSibling(Camera),
    };
  }

  public onAdded({ camera }: MouseDeps): void {
    this._camera = camera;

    const canvas = this._app.canvas;

    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);

    // Listen on window for mouseup so that releases off-canvas (after
    // dragging the cursor away from the game) clear the button state.
    // Guarded for non-browser environments — Jest's jsdom provides
    // `window`, but Node-only tooling running the engine won't.
    if (typeof window !== 'undefined') {
      window.addEventListener('mouseup', this._onMouseUp);
    }
  }

  public onPreUpdate(): void {
    this._snapshotScreenPosition.set(
      this._pendingScreenX,
      this._pendingScreenY,
    );
    this._snapshotLeft = this._pendingLeft;
    this._snapshotRight = this._pendingRight;
    this._snapshotMiddle = this._pendingMiddle;
  }

  public onUpdate(): void {
    // No work — the input sampling that this component is responsible for
    // already happened in onPreUpdate, and the world-space transform that
    // turns the snapshot into a `MouseState.position` is computed lazily
    // in `getState` so it picks up the freshest camera value.
  }

  public onDestroy(): void {
    const canvas = this._app.canvas;

    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('mousedown', this._onMouseDown);

    if (typeof window !== 'undefined') {
      window.removeEventListener('mouseup', this._onMouseUp);
    }
  }

  /**
   * Returns the current {@link MouseState} snapshot. The world-space
   * `position` is recomputed each call using the live {@link Camera}
   * transform, so a follow-camera that mutates `camera.position` during
   * `onPostUpdate` is honoured by the very next tick's reads.
   *
   * Allocates a new {@link MouseState} (and two fresh {@link Point}s) per
   * call — game code may stash the returned object for the duration of a
   * frame without worrying about mid-frame mutation.
   */
  public getState(): MouseState {
    return {
      position: this._computeWorldPosition(),
      screenPosition: this._snapshotScreenPosition.clone(),
      leftButton: this._snapshotLeft,
      rightButton: this._snapshotRight,
      middleButton: this._snapshotMiddle,
    };
  }

  /**
   * Applies the inverse of {@link Scene}'s camera transform to the
   * snapshotted screen position. The forward transform applied to the
   * scene container is:
   *
   * 1. Pivot the world at `camera.position`.
   * 2. Move that pivot to the canvas centre.
   * 3. Rotate by `-camera.rotation`.
   *
   * So the inverse, taking a canvas-local point back to world space, is:
   *
   * 1. Subtract the canvas centre.
   * 2. Rotate by `+camera.rotation`.
   * 3. Add `camera.position`.
   *
   * When zoom is added to the camera in the future, an extra divide-by-
   * zoom step slots in between (2) and (3).
   */
  private _computeWorldPosition(): Point {
    const camera = this._camera;
    const result = this._snapshotScreenPosition.clone();

    if (!camera) {
      return result;
    }

    const screen = this._app.screen;

    return result
      .subtract(screen.width / 2, screen.height / 2)
      .rotate(camera.rotation)
      .add(camera.position);
  }

  private _writeButton(button: number, pressed: boolean): void {
    // MouseEvent.button: 0 = primary (left), 1 = auxiliary (middle),
    // 2 = secondary (right). Other values (back/forward thumb buttons)
    // are ignored — they're rarely used in game input and the standard
    // three cover the common case.
    if (button === 0) {
      this._pendingLeft = pressed;
    } else if (button === 1) {
      this._pendingMiddle = pressed;
    } else if (button === 2) {
      this._pendingRight = pressed;
    }
  }
}
