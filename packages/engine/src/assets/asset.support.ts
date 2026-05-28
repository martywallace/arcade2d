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
 * File extensions the engine recognises as audio clips, mapped to
 * {@link AssetType.Audio}. Lower-cased and without the leading dot. Covers
 * the formats the browser's `decodeAudioData` accepts in mainstream engines:
 * MP3, Ogg Vorbis, WAV, M4A/AAC, FLAC, and the WebM/Opus pair. Browser
 * support varies per format — pick a format your target browsers all decode,
 * or ship a fallback path that loads a different one.
 */
const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set([
  'mp3',
  'ogg',
  'oga',
  'wav',
  'm4a',
  'aac',
  'flac',
  'webm',
  'weba',
  'opus',
]);

/**
 * File extensions the engine recognises as fonts, mapped to
 * {@link AssetType.Font}. Lower-cased and without the leading dot. These are
 * the four formats the browser `FontFace` API and PIXI's web-font loader
 * accept — TrueType, OpenType, and the WOFF/WOFF2 web-optimised wrappers.
 */
const FONT_EXTENSIONS: ReadonlySet<string> = new Set([
  'ttf',
  'otf',
  'woff',
  'woff2',
]);

/**
 * Infers the {@link AssetType} of a resource from its path — either the MIME
 * type of a `data:` URL or, for ordinary paths, the file extension.
 *
 * This is the default type-resolution strategy used by
 * {@link AssetLibrary.load} — `player.png` resolves to {@link AssetType.Image}
 * without the caller stating a type. Inference is deliberately conservative:
 * for a path it looks only at the file extension, strips any `?query` and
 * `#hash` suffix first, and lower-cases the result. It does **not** sniff
 * content or issue a network request.
 *
 * ### Data URLs
 *
 * Bundlers inline small assets as `data:` URLs (e.g. Vite inlines imports
 * under its `assetsInlineLimit`), which have no file extension but do declare
 * a MIME type in their header. A `data:image/...` URL therefore resolves to
 * {@link AssetType.Image} from the MIME type alone — important because the
 * same `import url from './sprite.png'` yields a real file URL in dev and an
 * inlined data URL in a production build.
 *
 * Returns `null` rather than throwing when the type cannot be determined, so
 * the caller decides how to react — {@link AssetLibrary.load} turns a `null`
 * into an {@link EngineError} with {@link ErrorCode.ASSET_TYPE_MISMATCH}, but
 * other callers may prefer to fall back to an explicit type. Pass
 * {@link AssetLoadOptions.type} to bypass inference entirely for URLs whose
 * extension or MIME type lies or is missing.
 *
 * @param path The resource path or URL to inspect. May be a `data:` URL, and
 * may carry a query string or hash fragment; both are ignored for extension
 * matching.
 * @returns The inferred {@link AssetType}, or `null` when no type can be
 * determined.
 *
 * @example
 * ```ts
 * inferAssetType('sprites/player.png');         // AssetType.Image
 * inferAssetType('tiles.webp?v=3');             // AssetType.Image
 * inferAssetType('data:image/png;base64,iVB…'); // AssetType.Image
 * inferAssetType('https://cdn.test/hero');      // null — no extension
 * inferAssetType('music/theme.ogg');            // AssetType.Audio
 * ```
 */
export function inferAssetType(path: string): AssetType | null {
  // Data URLs carry no extension but declare their type in the header, e.g.
  // `data:image/png;base64,...`. Read the MIME type instead.
  if (path.startsWith('data:')) {
    return inferFromDataUrl(path);
  }

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

  if (AUDIO_EXTENSIONS.has(extension)) {
    return AssetType.Audio;
  }

  if (FONT_EXTENSIONS.has(extension)) {
    return AssetType.Font;
  }

  return null;
}

// Reads the MIME type from a `data:` URL header and maps an `image/*` type to
// AssetType.Image. The header is everything between the `data:` scheme and the
// first `;` or `,` — e.g. `data:image/png;base64,...` -> `image/png`.
function inferFromDataUrl(url: string): AssetType | null {
  const headerEnd = url.search(/[;,]/);
  const mime = (
    headerEnd === -1
      ? url.slice('data:'.length)
      : url.slice('data:'.length, headerEnd)
  ).toLowerCase();

  if (mime.startsWith('image/')) {
    return AssetType.Image;
  }

  if (mime.startsWith('audio/')) {
    return AssetType.Audio;
  }

  if (mime.startsWith('font/') || mime === 'application/font-woff') {
    return AssetType.Font;
  }

  return null;
}
