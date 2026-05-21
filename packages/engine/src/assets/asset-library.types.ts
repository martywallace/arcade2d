import type { Asset } from './asset';
import type { AssetType } from './asset.constants';

/**
 * A constructor for a concrete {@link Asset} subclass (e.g. {@link ImageAsset}),
 * used as a runtime type witness by {@link AssetLibrary.getAs}. Mirrors the
 * `ComponentHostConstructor` pattern used for typed component lookups: the
 * class value is passed purely as an `instanceof` discriminator, never
 * invoked.
 */
export type AssetConstructor<T extends Asset> = new (...args: never[]) => T;

/**
 * Per-load configuration for {@link AssetLibrary.load}.
 *
 * Every field is optional; `load(path)` with no options stores the asset
 * under the path itself, in the {@link DEFAULT_ASSET_NAMESPACE}, with its
 * type inferred from the path's extension. Override individual fields as
 * needed.
 */
export type AssetLoadOptions = {
  /**
   * The key to store the loaded asset under, used later with
   * {@link AssetLibrary.get}. Defaults to the load path. Prefer a short
   * friendly alias (`'player'`) over threading the full path through your
   * code. Must be unique within its {@link AssetLoadOptions.namespace}.
   */
  readonly key?: string;

  /**
   * The namespace to store the asset under. Defaults to
   * {@link DEFAULT_ASSET_NAMESPACE}. Keys are unique per namespace, and a
   * namespace is the unit of bulk unloading via
   * {@link AssetLibrary.unloadNamespace}.
   */
  readonly namespace?: string;

  /**
   * Explicit {@link AssetType}, bypassing extension inference. Provide this
   * for URLs whose extension is missing or misleading — a CDN route, a
   * query-string-suffixed URL, an extensionless path. When omitted, the type
   * is inferred from the path; a path whose type cannot be inferred and that
   * carries no explicit type throws {@link ErrorCode.ASSET_TYPE_MISMATCH}.
   */
  readonly type?: AssetType;
};

/**
 * Configuration for {@link AssetLibrary.loadMany}. Identical to
 * {@link AssetLoadOptions} but without `key` — each path in the batch is
 * stored under its own path, so a single shared key would collide. To assign
 * friendly keys to several assets, call {@link AssetLibrary.load} per asset.
 */
export type AssetLoadManyOptions = Omit<AssetLoadOptions, 'key'>;
