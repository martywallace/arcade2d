import type { PointPrimitive } from '../geometry';
import type { TexturedGraphicsOptions } from './abstract-textured-graphics.types';

/**
 * Construction-time configuration for a {@link TilingSprite}. Extends the
 * shared {@link TexturedGraphicsOptions} (`anchor`, `tint`, `alpha`,
 * `visible`) with the region and tiling controls. `width` and `height` are
 * required — they define the region the texture tiles across — and everything
 * else takes the documented default.
 */
export interface TilingSpriteOptions extends TexturedGraphicsOptions {
  /**
   * Width of the tiled region in world units (before the host's scale). The
   * texture repeats horizontally to fill it.
   */
  readonly width: number;

  /**
   * Height of the tiled region in world units (before the host's scale). The
   * texture repeats vertically to fill it.
   */
  readonly height: number;

  /**
   * Scale applied to each repeated tile, independent of the host transform.
   * The lever for drawing small pixel-art tiles at a larger on-screen size
   * without changing how many tiles fit the region. Pass a single number for
   * both axes or a {@link PointPrimitive} for independent values. Defaults to
   * `1`.
   */
  readonly tileScale?: number | PointPrimitive;

  /**
   * Offset of the tiling pattern within the region, in (pre-tileScale)
   * texture pixels. Animating this is how you scroll a background. Defaults
   * to `{ x: 0, y: 0 }`.
   */
  readonly tileOffset?: PointPrimitive;
}
