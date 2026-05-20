import { AbstractGameComponent } from '../abstract-game-component';
import type { KeyboardState } from './keyboard.types';

/**
 * Game-scoped input sampler that tracks the set of physical keys currently
 * held on the keyboard.
 *
 * Like {@link Keyboard}'s sibling {@link import('./mouse').Mouse}, this
 * component lives at the {@link Game} tier rather than on a `World`:
 * keyboard events are page-global, fire whether a world is mounted or not,
 * and the same physical keyboard is shared across world swaps (menu →
 * gameplay → game-over). Game code reads keyboard state via the
 * convenience accessors on the game or world — `game.getKeyboardState()`
 * or `world.getKeyboardState()` — rather than touching this component
 * directly; the class itself is exported so callers writing custom
 * bootstrap, or users who want to swap in a custom input source (e.g. a
 * recorded-input variant for tests), have something concrete to construct
 * and register.
 *
 * ## Physical vs logical keys
 *
 * Held state is keyed by `KeyboardEvent.code` (the physical key) rather
 * than `KeyboardEvent.key` (the logical character). This is the standard
 * choice for game input — WASD movement keeps working on AZERTY or Dvorak
 * layouts without per-layout remapping, because the four keys in the
 * top-left of the letter block always report as `KeyW`/`KeyA`/`KeyS`/
 * `KeyD` regardless of what character they actually produce. See
 * {@link KeyboardState} for the cross-reference to MDN's code-value list.
 *
 * ## Snapshot semantics
 *
 * The component follows the canonical "input sampler" pattern, identical
 * to {@link import('./mouse').Mouse}:
 *
 * 1. DOM events update a private *pending* set as they arrive — this is
 *    asynchronous and can happen at any time relative to the engine's
 *    update tick.
 * 2. {@link Keyboard.onPreUpdate} copies the pending set into a private
 *    *snapshot* once per game tick, before the active world's update
 *    phase runs.
 * 3. {@link Keyboard.getState} returns a {@link KeyboardState} derived from
 *    the snapshot, so every component reading the keyboard during a
 *    single tick sees the same held-key set.
 *
 * ## Event sourcing
 *
 * Listeners are attached during {@link Keyboard.onAdded} and removed in
 * {@link Keyboard.onDestroy}:
 *
 * - `keydown` and `keyup` are listened on `window`. The canvas itself
 *   does not receive keyboard events unless explicitly focused (which
 *   requires a `tabindex` and is fragile across browsers), so window-
 *   level listening is the standard choice for browser games.
 * - `blur` on `window` clears the pending set. Without this, a key held
 *   when the user alt-tabs away never receives its `keyup` and stays
 *   "stuck down" forever — a class of bug that's both common and very
 *   annoying to debug.
 *
 * The engine does not call `event.preventDefault()` on any of these — game
 * code is free to do that itself if it wants to suppress browser defaults
 * like Space scrolling the page or Tab moving focus. Suppressing globally
 * here would break browser UX for any non-gameplay UI rendered on the
 * same page.
 *
 * ## Auto-repeat
 *
 * Browsers fire repeated `keydown` events while a key is held, with
 * `event.repeat === true`. The component does not filter these — adding
 * to the pending set is idempotent and the held-state semantics are
 * unchanged. Edge-triggered "just pressed this frame" detection is *not*
 * provided by this component; layer that on at the
 * action-mapping/`GameControls` tier when it lands.
 */
export class Keyboard extends AbstractGameComponent {
  private readonly _pendingDown = new Set<string>();
  private readonly _snapshotDown = new Set<string>();

  private readonly _onKeyDown = (event: KeyboardEvent): void => {
    this._pendingDown.add(event.code);
  };

  private readonly _onKeyUp = (event: KeyboardEvent): void => {
    this._pendingDown.delete(event.code);
  };

  private readonly _onBlur = (): void => {
    // Releases that happen while the window is unfocused (the user
    // alt-tabbed away mid-keypress) never reach us as `keyup`, so the
    // safe thing is to assume nothing is held the moment focus is lost.
    // The next focus + keydown will repopulate the set naturally.
    this._pendingDown.clear();
  };

  public override onAdded(): void {
    // Guarded for non-browser environments — Jest's jsdom provides
    // `window`, but Node-only tooling running the engine won't.
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('blur', this._onBlur);
    }
  }

  public onPreUpdate(): void {
    // Replace the snapshot contents with the pending set's contents.
    // Using clear+add rather than allocating a new Set avoids churn on
    // the hot path; the snapshot Set is internal and never exposed
    // directly to callers (getState clones it).
    this._snapshotDown.clear();
    for (const code of this._pendingDown) {
      this._snapshotDown.add(code);
    }
  }

  public override onDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      window.removeEventListener('blur', this._onBlur);
    }
  }

  /**
   * Returns a fresh {@link KeyboardState} per call — game code may stash
   * the returned object for the duration of a frame without worrying
   * about mid-frame mutation. The contained `downKeys` set is a fresh
   * clone of the internal snapshot, exposed as `ReadonlySet<string>` so
   * callers cannot accidentally mutate engine state through it.
   */
  public getState(): KeyboardState {
    const downKeys: ReadonlySet<string> = new Set(this._snapshotDown);

    return {
      downKeys,
      isDown: (code: string): boolean => downKeys.has(code),
    };
  }
}
