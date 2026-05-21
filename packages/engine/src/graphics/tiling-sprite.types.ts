import type { PointPrimitive } from '../geometry';

/**
 * Construction-time configuration for a {@link TilingSprite}. `width` and
 * `height` are required — they define the region the texture tiles across —
 * and everything else takes the documented default.
 */
export type TilingSpriteOptions = {
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

  /**
   * The anchor point — the spot on the region that sits on the host
   * {@link WorldObject}'s position — as a fraction (`0`–`1`) per axis. Pass a
   * number for both axes or a {@link PointPrimitive}. Defaults to `0.5`
   * (centred), matching {@link Sprite}.
   */
  readonly anchor?: number | PointPrimitive;

  /**
   * Multiplicative tint as a 24-bit RGB integer; `0xffffff` is untinted.
   * Defaults to `0xffffff`.
   */
  readonly tint?: number;

  /**
   * Opacity from `0` (transparent) to `1` (opaque). Defaults to `1`.
   */
  readonly alpha?: number;

  /**
   * Whether the tiling sprite is drawn. Defaults to `true`.
   */
  readonly visible?: boolean;
};
