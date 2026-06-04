/**
 * The visual options shared by *every* graphics component — shape and textured
 * alike. Specific option types ({@link ShapeGraphicsOptions},
 * {@link TexturedGraphicsOptions}) extend this with the extras their component
 * understands, so `alpha` and `visible` mean the same thing everywhere.
 */
export interface GraphicsOptions {
  /**
   * Opacity in the range `0` (fully transparent) to `1` (fully opaque).
   * Defaults to `1`.
   */
  readonly alpha?: number;

  /**
   * Whether the graphic is drawn at all. A hidden graphic still ticks and
   * keeps its transform in sync; it is simply skipped by the renderer.
   * Defaults to `true`.
   */
  readonly visible?: boolean;
}
