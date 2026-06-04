/**
 * Construction options for a {@link PhysicsDebugRenderer}. Every field is
 * optional; the defaults trace each body's colliders as a one-pixel outline
 * tinted with Rapier's own debug colours.
 */
export interface PhysicsDebugRendererOptions {
  /**
   * Outline stroke width, in world pixels. Because the overlay is a child of
   * the {@link Scene}, this width is in the same world space as the bodies —
   * it scales with {@link Camera.zoom} along with everything else. Defaults to
   * `1`.
   */
  readonly lineWidth?: number;

  /**
   * A single colour, as a 24-bit RGB integer, to draw every outline in. When
   * omitted, the renderer uses Rapier's per-collider debug colours instead,
   * which encode useful state — awake versus sleeping bodies, sensors versus
   * solid colliders — at the cost of a draw call per segment. Set this to a
   * fixed colour (e.g. `0xff0000`) when you only care about the silhouettes
   * and want the cheaper single-stroke path.
   */
  readonly color?: number;
}
