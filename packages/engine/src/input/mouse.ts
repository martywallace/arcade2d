import { AbstractGameComponent } from '../abstract-game-component';
import { Point } from '../geometry';
import type { MouseSnapshot } from './mouse.types';

/**
 * Game-scoped input sampler that tracks the canvas-local mouse position
 * and the state of the three standard buttons (left, middle, right).
 *
 * `Mouse` lives at the {@link Game} tier rather than on a {@link World}
 * because mouse input is inherently page-global — DOM events fire whether
 * a world is mounted or not, and the same physical cursor is shared
 * across world swaps (menu → gameplay → game-over). The world-space
 * projection of the cursor is layered on top by {@link World.getMouseState}
 * which reads this snapshot and runs it through the active world's camera.
 *
 * Most game code reads mouse state via the convenience accessors on the
 * game or world — `game.getMouseState()` for screen space,
 * `world.getMouseState()` for world space — rather than touching this
 * component directly; the class itself is exported so that callers
 * writing custom bootstrap, or users who want to swap in a custom input
 * source (e.g. a recorded-input variant for tests), have something
 * concrete to construct and register.
 *
 * ## Snapshot semantics
 *
 * The component follows the canonical "input sampler" pattern described in
 * the {@link World} docblock, applied one tier up:
 *
 * 1. DOM events update a private *pending* buffer as they arrive — this is
 *    asynchronous and can happen at any time relative to the engine's
 *    update tick.
 * 2. {@link Mouse.onPreUpdate} copies the pending buffer into a private
 *    *snapshot* once per game tick, before the active world's update phase
 *    runs.
 * 3. {@link Mouse.getState} returns a {@link MouseSnapshot} derived from the
 *    snapshot, so every component reading the mouse during a single tick
 *    sees the same screen-space position and the same button states.
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
export class Mouse extends AbstractGameComponent {
  private _pendingScreenX = 0;
  private _pendingScreenY = 0;
  private _pendingLeft = false;
  private _pendingRight = false;
  private _pendingMiddle = false;

  private readonly _snapshotScreenPosition = new Point(0, 0);
  private _snapshotLeft = false;
  private _snapshotRight = false;
  private _snapshotMiddle = false;

  private readonly _onMouseMove = (event: MouseEvent): void => {
    // clientX/Y are page-relative; subtract the canvas's current bounding
    // rect to land in canvas-local coordinates. `getBoundingClientRect` is
    // cheap enough on a per-mousemove cadence (browsers cache the result
    // until the next layout invalidation) and is robust to the canvas
    // being positioned anywhere on the page — including inside scrolled
    // containers and CSS-transformed layouts, where `offsetX/Y` and the
    // various older alternatives quietly disagree.
    const rect = this.host.canvas.getBoundingClientRect();

    this._pendingScreenX = event.clientX - rect.left;
    this._pendingScreenY = event.clientY - rect.top;
  };

  private readonly _onMouseDown = (event: MouseEvent): void => {
    this._writeButton(event.button, true);
  };

  private readonly _onMouseUp = (event: MouseEvent): void => {
    this._writeButton(event.button, false);
  };

  public override onAdded(): void {
    const canvas = this.host.canvas;

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

  public override onDestroy(): void {
    const canvas = this.host.canvas;

    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('mousedown', this._onMouseDown);

    if (typeof window !== 'undefined') {
      window.removeEventListener('mouseup', this._onMouseUp);
    }
  }

  /**
   * Returns a fresh {@link MouseSnapshot} per call — game code may stash
   * the returned object for the duration of a frame without worrying
   * about mid-frame mutation. The contained {@link Point} for
   * `screenPosition` is also a fresh clone.
   */
  public getState(): MouseSnapshot {
    return {
      screenPosition: this._snapshotScreenPosition.clone(),
      buttons: {
        left: this._snapshotLeft,
        right: this._snapshotRight,
        middle: this._snapshotMiddle,
      },
    };
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
