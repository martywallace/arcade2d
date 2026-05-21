/**
 * A rectangular sub-region of an image, in source-pixel coordinates, used to
 * sample one frame out of a larger image (a spritesheet cell, a tileset tile,
 * an animation frame).
 *
 * The geometry {@link Rectangle} is deliberately *not* reused here: that shape
 * is positionless (anchored at its own `0,0`), whereas a texture frame needs
 * an `(x, y)` origin within the source image. `TextureFrame` is the small,
 * honest "pixel rect in image space" type for exactly that.
 *
 * Coordinates follow the engine's screen-space convention: `(0, 0)` is the
 * image's top-left, `x` grows right, `y` grows down.
 */
export type TextureFrame = {
  /** Left edge of the region, in source pixels from the image's left. */
  readonly x: number;
  /** Top edge of the region, in source pixels from the image's top. */
  readonly y: number;
  /** Width of the region in source pixels. */
  readonly width: number;
  /** Height of the region in source pixels. */
  readonly height: number;
};

/**
 * Describes how to slice a regular grid of equally-sized frames out of one
 * image — the common layout for tilesets and animation strips. Consumed by
 * {@link Texture.grid}, which walks the grid in row-major order (left to
 * right, then top to bottom) and returns one {@link Texture} per cell.
 *
 * The image is treated as a grid of `columns` × `rows` cells, each
 * `frameWidth` × `frameHeight` pixels, optionally inset from the image edge by
 * `offsetX`/`offsetY` and separated by `spacingX`/`spacingY` gutters.
 */
export type TextureGridOptions = {
  /** Width of each cell in source pixels. Expected to be a positive integer. */
  readonly frameWidth: number;
  /** Height of each cell in source pixels. Expected to be a positive integer. */
  readonly frameHeight: number;
  /** Number of cells per row. Expected to be a positive integer. */
  readonly columns: number;
  /** Number of rows. Expected to be a positive integer. */
  readonly rows: number;
  /**
   * Horizontal inset from the image's left edge to the first cell, in source
   * pixels. Defaults to `0`.
   */
  readonly offsetX?: number;
  /**
   * Vertical inset from the image's top edge to the first cell, in source
   * pixels. Defaults to `0`.
   */
  readonly offsetY?: number;
  /**
   * Horizontal gutter between adjacent cells, in source pixels. Defaults to
   * `0`.
   */
  readonly spacingX?: number;
  /**
   * Vertical gutter between adjacent rows, in source pixels. Defaults to `0`.
   */
  readonly spacingY?: number;
  /**
   * Cap on how many frames to emit, for sheets whose final row is partially
   * filled. Defaults to `columns * rows`; values above that are clamped to
   * it.
   */
  readonly count?: number;
};
