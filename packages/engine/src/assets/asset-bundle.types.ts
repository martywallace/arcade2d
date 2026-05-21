import type { AssetType } from './asset.constants';

/**
 * The shape of an {@link AssetBundle}'s entry map: a record of friendly key
 * to load path. The keys become the compile-time-checked argument to
 * {@link BoundAssetBundle.get}; the values are the paths fed to the loader.
 *
 * Declared with literal-preserving inference by {@link defineAssetBundle}, so
 * a bundle's key union is exactly the keys you wrote — `get` on an unknown
 * key is a type error, not a runtime throw.
 */
export type AssetBundleEntries = Readonly<Record<string, string>>;

/**
 * The union of valid key arguments for a bundle with entries `E` — its
 * string keys. Used to type {@link BoundAssetBundle.get} and friends so a
 * mistyped or undeclared key fails at compile time.
 */
export type AssetBundleKey<E extends AssetBundleEntries> = keyof E & string;

/**
 * Options for {@link BoundAssetBundle.load}.
 */
export type AssetBundleLoadOptions = {
  /**
   * Explicit {@link AssetType} applied to every entry in the bundle,
   * bypassing per-path extension inference. Use for a bundle of
   * extensionless or CDN-routed paths. When omitted, each entry's type is
   * inferred from its path.
   */
  readonly type?: AssetType;
};
