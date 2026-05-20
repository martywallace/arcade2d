/**
 * Reserved component key used by the engine to register the auto-attached
 * {@link Camera} on every {@link World}. Surfaces as a constant so user
 * code that — for whatever reason — needs to introspect the camera by key
 * doesn't have to hard-code a magic string, and so the collision message
 * in `addComponents` can mention the constant rather than a raw literal.
 */
export const CAMERA_COMPONENT_KEY = 'camera';

/**
 * Reserved component key used by {@link Game.createWorld} to register the
 * world's {@link Scene} graphics root. Exposed so callers that need to
 * introspect or replace the scene (e.g. swapping in a custom renderer
 * mount) have a name to refer to without hard-coding a magic string.
 */
export const SCENE_COMPONENT_KEY = 'scene';
