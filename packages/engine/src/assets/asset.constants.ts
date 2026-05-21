/**
 * The kind of resource an {@link Asset} wraps. The type determines which
 * concrete {@link Asset} subclass an {@link AssetLibrary} produces when it
 * loads a path, and which typed payload accessor that subclass exposes
 * (e.g. {@link ImageAsset.raw} returns a texture for {@link AssetType.Image}).
 *
 * The type is normally inferred from a path's file extension (see
 * `inferAssetType`), but callers can override the inference per load when a
 * URL has no usable extension — a CDN path, a query-string-suffixed URL, an
 * extensionless route. See {@link AssetLoadOptions.type}.
 *
 * Audio and other resource kinds are planned but not yet implemented; this
 * iteration supports images only.
 */
export enum AssetType {
  /**
   * A raster image — PNG, JPEG, WebP, GIF, AVIF, BMP, or SVG — loaded into a
   * GPU texture. Wrapped by {@link ImageAsset} and consumed by texture- and
   * sprite-rendering components.
   */
  Image = 'image',
}
