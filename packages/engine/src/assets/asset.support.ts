import { AssetType } from './asset.constants';

/**
 * File extensions the engine recognises as raster images, mapped to
 * {@link AssetType.Image}. Lower-cased and without the leading dot. SVG is
 * included because PIXI rasterises it into a texture on load, so from the
 * engine's perspective it behaves like any other {@link AssetType.Image}.
 */
const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'avif',
  'bmp',
  'svg',
]);

/**
 * Infers the {@link AssetType} of a resource from its path's file extension.
 *
 * This is the default type-resolution strategy used by
 * {@link AssetLibrary.load} — `player.png` resolves to {@link AssetType.Image}
 * without the caller stating a type. Inference is deliberately conservative:
 * the function looks only at the file extension, strips any `?query` and
 * `#hash` suffix first, and lower-cases the result. It does **not** sniff
 * content or issue a network request.
 *
 * Returns `null` rather than throwing when the extension is absent or
 * unrecognised, so the caller decides how to react — {@link AssetLibrary.load}
 * turns a `null` into an {@link EngineError} with
 * {@link ErrorCode.ASSET_TYPE_MISMATCH}, but other callers may prefer to fall
 * back to an explicit type. Pass {@link AssetLoadOptions.type} to bypass
 * inference entirely for URLs whose extension lies or is missing.
 *
 * @param path The resource path or URL to inspect. May carry a query string
 * or hash fragment; both are ignored for the purposes of extension matching.
 * @returns The inferred {@link AssetType}, or `null` when no type can be
 * determined from the extension.
 *
 * @example
 * ```ts
 * inferAssetType('sprites/player.png');      // AssetType.Image
 * inferAssetType('tiles.webp?v=3');          // AssetType.Image
 * inferAssetType('https://cdn.test/hero');   // null — no extension
 * inferAssetType('track.ogg');               // null — not yet supported
 * ```
 */
export function inferAssetType(path: string): AssetType | null {
  // Strip query/hash before looking at the extension so `tiles.png?v=3`
  // and `icon.svg#frag` resolve the same as their bare forms.
  const suffixStart = path.search(/[?#]/);
  const withoutSuffix = suffixStart === -1 ? path : path.slice(0, suffixStart);

  const lastDot = withoutSuffix.lastIndexOf('.');
  const lastSlash = withoutSuffix.lastIndexOf('/');

  // A dot only names an extension when it comes after the final path
  // separator — otherwise `./assets/hero` would read `/assets/hero` as the
  // extension of the leading `.`.
  if (lastDot === -1 || lastDot < lastSlash) {
    return null;
  }

  const extension = withoutSuffix.slice(lastDot + 1).toLowerCase();

  if (IMAGE_EXTENSIONS.has(extension)) {
    return AssetType.Image;
  }

  return null;
}
