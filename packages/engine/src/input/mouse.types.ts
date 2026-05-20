import type { Point } from '../geometry';

/**
 * Held-state booleans for the three standard mouse buttons, exposed as a
 * named bag on {@link MouseSnapshot} (and {@link MouseState}) so they're
 * a) addressable as a group (`if (state.buttons.left)`) and b) easy to
 * extend with extra buttons (`back`, `forward`) without flattening the
 * top-level shape further.
 */
export interface MouseButtons {
  /**
   * `true` while the primary (left) mouse button is held.
   */
  readonly left: boolean;

  /**
   * `true` while the secondary (right) mouse button is held. The engine
   * does **not** suppress the browser's native context menu on right-click
   * — applications that want to use the right button as a game input
   * should add their own `contextmenu` listener and call
   * `event.preventDefault()`.
   */
  readonly right: boolean;

  /**
   * `true` while the middle (wheel) mouse button is held.
   */
  readonly middle: boolean;
}

/**
 * Per-tick snapshot of mouse state at the **game tier** — canvas-local
 * pointer position and held button state, with no concept of a camera or
 * world transform. Returned by {@link Mouse.getState} and by
 * `Game.getMouseState()`.
 *
 * Game-tier code working in screen space (HUDs, menus, click-through
 * detection on UI overlays) should read this directly. Game-world code
 * that wants the cursor in world coordinates should reach for
 * `World.getMouseState`, which extends this snapshot into a full
 * {@link MouseState} with a `position` field projected through the active
 * world's camera.
 *
 * Returned objects are fresh on every call — the engine intentionally
 * does **not** hand back a live reference, so a caller stashing the value
 * for a frame won't see it change mid-update.
 */
export interface MouseSnapshot {
  /**
   * Cursor position in canvas-local pixels. `(0, 0)` is the canvas's
   * top-left, regardless of where the canvas sits on the page.
   */
  readonly screenPosition: Point;

  /**
   * Held state of the three standard mouse buttons. See
   * {@link MouseButtons} for the per-button semantics.
   */
  readonly buttons: MouseButtons;
}

/**
 * Per-tick snapshot of mouse state at the **world tier** — the
 * {@link MouseSnapshot} plus a `position` field giving the cursor's
 * location in world space, with the active world's camera transform
 * already inverted out. Returned by `World.getMouseState`.
 *
 * - {@link MouseState.position} reflects the camera's inverse transform.
 *   With the default camera, this matches {@link MouseSnapshot.screenPosition}
 *   shifted so the canvas centre maps to world `(0, 0)`. Moving, rotating,
 *   or zooming the camera shifts the world position accordingly. Camera
 *   *shake* is excluded so a click during a shake still resolves to the
 *   logical world point.
 * - Inherits the screen-space `screenPosition` and `buttons` fields from
 *   {@link MouseSnapshot}.
 */
export interface MouseState extends MouseSnapshot {
  /**
   * Cursor position in world space. See the interface-level docs for the
   * exact camera-transform semantics.
   */
  readonly position: Point;
}
