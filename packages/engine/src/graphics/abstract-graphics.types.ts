import type { Layer } from './layer';

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

  /**
   * The render layer this graphic draws in, as a {@link Layer} token from the
   * world's {@link LayerSet} (e.g. `layers.get('characters')`).
   *
   * Layers are opt-in per world. If the world was created with `layers`, this
   * is **required** — omitting it throws {@link ErrorCode.LAYER_UNSPECIFIED},
   * since a layered world has no implicit default band. If the world has no
   * layer set, this must be omitted — passing it throws
   * {@link ErrorCode.LAYER_SET_ABSENT}. Change it later with
   * {@link AbstractGraphics.layer} to move the graphic between bands.
   */
  readonly layer?: Layer;
}
