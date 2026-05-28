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
 * Branch on the type to recover the concrete subclass and its payload
 * accessor (see the class-level docs on {@link Asset} for the pattern).
 */
export enum AssetType {
  /**
   * A raster image — PNG, JPEG, WebP, GIF, AVIF, BMP, or SVG — loaded into a
   * GPU texture. Wrapped by {@link ImageAsset} and consumed by texture- and
   * sprite-rendering components.
   */
  Image = 'image',

  /**
   * An audio clip — MP3, OGG, WAV, M4A, AAC, FLAC, WebM, or Opus — decoded
   * into a `Web Audio` `AudioBuffer`. Wrapped by {@link AudioAsset} and
   * consumed by audio-playing components ({@link AudioSource},
   * {@link Music}).
   */
  Audio = 'audio',

  /**
   * A font file — TTF, OTF, WOFF, or WOFF2 — loaded into a browser
   * `FontFace` and registered on `document.fonts` so canvas-tier text can
   * draw with it. Wrapped by {@link FontAsset} and consumed by
   * {@link Text}.
   */
  Font = 'font',
}
