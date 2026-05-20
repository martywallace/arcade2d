/**
 * Per-tick snapshot of keyboard state — the set of currently-held physical
 * keys and a convenience predicate for membership tests. Returned by
 * {@link Keyboard.getState} and by `Game.getKeyboardState()`.
 *
 * Keys are identified by their `KeyboardEvent.code` string — the
 * **physical** key, not the **logical** character it produces. `KeyA` is
 * the key in the top-left of the letter block regardless of whether the
 * user has a QWERTY, AZERTY, or Dvorak layout, so binding gameplay
 * controls to `KeyW` / `KeyA` / `KeyS` / `KeyD` keeps WASD movement
 * working across layouts without per-layout remapping. See
 * [MDN's `code` values](https://developer.mozilla.org/docs/Web/API/UI_Events/Keyboard_event_code_values)
 * for the full list — common gaming codes include `Space`, `Enter`,
 * `Escape`, `Tab`, `ShiftLeft`/`ShiftRight`, `ControlLeft`/`ControlRight`,
 * the `Arrow*` family, the `Digit*` row, and `F1`–`F12`.
 *
 * Returned objects are fresh on every call — the engine intentionally
 * does **not** hand back a live reference, so a caller stashing the value
 * for a frame won't see it change mid-update.
 */
export interface KeyboardState {
  /**
   * Returns `true` when the key with the given `KeyboardEvent.code` was
   * held at the moment this state was sampled. Cheap — a `Set.has` under
   * the hood.
   *
   * @param code The physical key identifier — see {@link KeyboardState}
   * for the convention.
   */
  isDown(code: string): boolean;

  /**
   * The full set of physical keys held at sample time, as a
   * `ReadonlySet<string>` of `KeyboardEvent.code` values. Use this when
   * the calling code needs to iterate (e.g. drawing an on-screen "keys
   * currently pressed" debug overlay) rather than test specific keys.
   */
  readonly downKeys: ReadonlySet<string>;
}
