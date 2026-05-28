import { Asset } from './asset';
import { AssetType } from './asset.constants';

/**
 * An {@link Asset} wrapping a loaded web font registered on the document's
 * `FontFaceSet`.
 *
 * `FontAsset` is what {@link AssetLibrary.load} produces for any path that
 * resolves to {@link AssetType.Font} — TTF, OTF, WOFF, or WOFF2. It is the
 * handoff between the asset layer and the text-rendering layer: the
 * {@link Text} component takes a `FontAsset` (or the {@link FontAsset.family}
 * string directly) and styles its underlying canvas text against that
 * family, so game code references fonts by key and never touches a
 * `FontFace` itself.
 *
 * The browser `FontFace` is deliberately *not* part of arcade2d's stable
 * surface — it is reachable only through {@link FontAsset.raw}, the escape
 * hatch. The one piece of public state callers actually need is
 * {@link FontAsset.family} — the family name a {@link Text}'s style should
 * use.
 *
 * ## Family-name derivation
 *
 * Fonts are loaded under a family name derived from the file's basename
 * with separators turned into spaces and words title-cased — e.g.
 * `press-start-2p.ttf` becomes `Press Start 2P`. This matches PIXI's
 * convention; pick filenames that produce a usable family name, or reach
 * for `Assets.load` directly (via {@link AssetLibrary.raw}) when you need
 * full control over `@font-face` descriptors.
 *
 * @example
 * ```ts
 * await game.assets.load('fonts/press-start-2p.ttf', { key: 'pixel' });
 * const pixel = game.assets.getAs('pixel', FontAsset);
 *
 * new Text(host, 'Score: 0', { fontFamily: pixel, fontSize: 16 });
 * ```
 *
 * @see {@link AssetLibrary} for how fonts are loaded and retrieved.
 * @see {@link Text} for the world-object component that draws strings.
 */
export class FontAsset extends Asset {
  public readonly type = AssetType.Font;

  /**
   * @param key See {@link Asset}. The name this font is stored under.
   * @param namespace See {@link Asset}. The group this font belongs to.
   * @param src See {@link Asset}. The resolved path the font loaded from.
   * @param _faces The loaded `FontFace`(s), held privately. PIXI's loader
   * returns a single face for a single-weight load and an array for a
   * multi-weight load; both shapes are accepted here. Exposed only via
   * {@link FontAsset.raw}; the public surface speaks in arcade2d terms.
   * @param family The CSS family name the loaded face(s) registered under.
   * This is what a {@link Text} style's `fontFamily` should match.
   */
  constructor(
    key: string,
    namespace: string,
    src: string,
    private readonly _faces: FontFace | readonly FontFace[],
    public readonly family: string,
  ) {
    super(key, namespace, src);
  }

  /**
   * Direct access to the underlying `FontFace`(s). A single-weight load
   * exposes one `FontFace`; a multi-weight load exposes a read-only array
   * with one entry per weight.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — inspecting per-weight load status,
   * unregistering a face from `document.fonts` ahead of an
   * {@link AssetLibrary.unload}, feeding the family into a non-PIXI
   * renderer. Code that touches `raw` is coupled to the browser's
   * `FontFace` API and may break when arcade2d swaps the font loader.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer {@link FontAsset.family} on this class; reach for `raw`
   * only when no equivalent exists, and isolate the access behind your own
   * helper so the coupling is in one place.
   */
  public get raw(): FontFace | readonly FontFace[] {
    return this._faces;
  }
}
