/**
 * Default stroke width, in world pixels, for {@link PhysicsDebugRenderer}
 * outlines when {@link PhysicsDebugRendererOptions.lineWidth} is omitted. One
 * pixel reads as a crisp hairline at the default camera zoom without obscuring
 * the body it traces.
 */
export const DEFAULT_DEBUG_LINE_WIDTH = 1;

/**
 * The `zIndex` assigned to the {@link PhysicsDebugRenderer}'s overlay so it
 * sorts above every regular graphics component. Bodies are typically drawn as
 * *filled* shapes, so an outline rendered beneath them would be completely
 * hidden — the overlay has to win the depth fight against anything in the
 * scene, including bodies spawned at runtime after the renderer was added.
 * A value this large keeps it on top without the caller ever needing to manage
 * the per-object `zIndex` of their own graphics.
 */
export const DEBUG_OVERLAY_Z_INDEX = 1_000_000;
