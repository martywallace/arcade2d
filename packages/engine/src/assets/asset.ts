import { AssetType } from './asset.constants';

/**
 * A loaded, ready-to-use game resource managed by an {@link AssetLibrary}.
 *
 * `Asset` is the abstract base of the engine's resource handles. Concrete
 * subclasses ({@link ImageAsset}, and audio/other kinds in future) carry the
 * parsed, GPU- or runtime-ready payload and expose it through a typed
 * accessor — never as raw bytes. Game code rarely constructs an `Asset`
 * directly; instead it preloads paths through {@link AssetLibrary.load} and
 * retrieves the resulting handle by key via {@link AssetLibrary.get}.
 *
 * ## Identity
 *
 * Every asset is identified by three immutable fields:
 *
 * - {@link Asset.key} — the developer-facing name the asset is stored under
 *   within its namespace. Defaults to the load path but is usually a short
 *   friendly alias (`'player'`, `'tileset'`).
 * - {@link Asset.namespace} — the grouping the asset belongs to. Namespaces
 *   keep keys unique only *within* a group and are the unit of bulk
 *   unloading (see {@link AssetLibrary.unloadNamespace}).
 * - {@link Asset.src} — the resolved path the resource was loaded from. This
 *   doubles as the underlying loader's cache key, so it is what
 *   {@link AssetLibrary.unload} hands back to the renderer to free GPU
 *   memory.
 *
 * ## Type discrimination
 *
 * {@link Asset.type} is a discriminant: narrow on it to recover the concrete
 * subclass and its payload accessor.
 *
 * ```ts
 * const asset = game.assets.get('player');
 * if (asset.type === AssetType.Image) {
 *   // asset is an ImageAsset here
 *   const { width, height } = asset as ImageAsset;
 * }
 * ```
 *
 * @see {@link AssetLibrary} for the loading and lifecycle model.
 * @see {@link ImageAsset} for the concrete image/texture handle.
 */
export abstract class Asset {
  /**
   * Discriminant identifying which concrete {@link Asset} subclass this is.
   * Branch on it to safely narrow to the payload-bearing subclass. See the
   * class-level docs for the narrowing pattern.
   */
  public abstract readonly type: AssetType;

  /**
   * @param key The developer-facing name this asset is stored under within
   * its {@link Asset.namespace}. Unique per namespace, not globally.
   * @param namespace The grouping this asset belongs to. The unit of bulk
   * unloading via {@link AssetLibrary.unloadNamespace}.
   * @param src The resolved path the resource was loaded from. Also the
   * underlying renderer's cache key, used to free the resource on unload.
   */
  constructor(
    public readonly key: string,
    public readonly namespace: string,
    public readonly src: string,
  ) {}
}
