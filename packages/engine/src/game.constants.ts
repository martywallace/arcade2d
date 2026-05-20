/**
 * Reserved component key the engine uses to register the {@link Mouse}
 * input sampler on every {@link Game}. Exposed as a constant so callers
 * that need to introspect or replace the mouse component (e.g. swapping in
 * a recorded-input variant for testing) don't have to hard-code a magic
 * string.
 */
export const MOUSE_COMPONENT_KEY = 'mouse';

/**
 * Reserved component key the engine uses to register the {@link Keyboard}
 * input sampler on every {@link Game}. Exposed as a constant so callers
 * that need to introspect or replace the keyboard component (e.g. swapping
 * in a recorded-input variant for testing) don't have to hard-code a magic
 * string.
 */
export const KEYBOARD_COMPONENT_KEY = 'keyboard';
