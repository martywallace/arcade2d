import type { Asset } from './asset';
import type { AssetBundle } from './asset-bundle';
import type {
  AssetBundleEntries,
  AssetBundleKey,
  AssetBundleLoadOptions,
} from './asset-bundle.types';
import type { AssetLibrary } from './asset-library';

/**
 * An {@link AssetBundle} bound to a specific {@link AssetLibrary} — the
 * callable form you actually load and read assets through.
 *
 * Obtain one from {@link AssetLibrary.use}. Every method delegates to the
 * underlying library, scoped to the bundle's namespace, but with one crucial
 * difference: {@link BoundAssetBundle.get} (and its siblings) accept *only*
 * the keys the bundle declared. A typo or an undeclared key is a compile
 * error here, where the untyped {@link AssetLibrary.get} would have thrown at
 * runtime — and only on the code path that happened to call it.
 *
 * The recommended pattern is to bind the bundle, load it eagerly at a coarse
 * boundary, then resolve individual assets at *registration* time (e.g. when
 * registering a prefab) rather than at spawn time, so any residual runtime
 * miss surfaces deterministically at startup instead of when a particular
 * object first appears.
 *
 * @template E The bundle's entry map type, carrying the literal key union.
 *
 * @example
 * ```ts
 * const lvl = game.assets.use(level1);
 * await lvl.load();                       // eager, whole-bundle
 * const zombieTexture = lvl.get('zombie'); // typed; resolve at registration
 * // ... later, on level exit:
 * await lvl.unload();
 * ```
 *
 * @see {@link AssetBundle} for the static declaration.
 * @see {@link AssetLibrary} for the untyped, dynamic-key API underneath.
 */
export class BoundAssetBundle<E extends AssetBundleEntries> {
  /**
   * @param _library The {@link AssetLibrary} this handle delegates to.
   * @param _bundle The {@link AssetBundle} definition being bound.
   */
  constructor(
    private readonly _library: AssetLibrary,
    private readonly _bundle: AssetBundle<E>,
  ) {}

  /**
   * The namespace this bundle's assets live in — the same one passed to
   * {@link defineAssetBundle}.
   */
  public get namespace(): string {
    return this._bundle.namespace;
  }

  /**
   * Loads every entry in the bundle into its namespace, in parallel. This is
   * the eager, coarse-grained preload the bundle model is built around — call
   * it once at a loading boundary, then read assets by key.
   *
   * Idempotent at the entry level: already-loaded entries resolve immediately
   * (see {@link AssetLibrary.load}). Resolves once every entry has settled.
   *
   * @param options Optional {@link AssetBundleLoadOptions}, e.g. an explicit
   * type applied to every entry.
   * @returns A promise resolving to the loaded {@link Asset} handles.
   * @throws The same {@link EngineError} codes as {@link AssetLibrary.load},
   *   surfaced from whichever entry failed.
   */
  public load(options: AssetBundleLoadOptions = {}): Promise<readonly Asset[]> {
    return Promise.all(
      Object.entries(this._bundle.entries).map(([key, path]) =>
        this._library.load(path, {
          key,
          namespace: this._bundle.namespace,
          type: options.type,
        }),
      ),
    );
  }

  /**
   * Fetches a loaded asset by one of the bundle's declared keys.
   *
   * The `key` argument is typed to the bundle's key union, so an unknown key
   * fails compilation. At runtime this is exactly
   * {@link AssetLibrary.get} scoped to the bundle's namespace, including its
   * {@link ErrorCode.ASSET_NOT_FOUND} throw if the bundle was never loaded.
   *
   * @param key A declared bundle key.
   * @returns The stored {@link Asset} handle.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_NOT_FOUND} when the bundle has not been loaded.
   */
  public get(key: AssetBundleKey<E>): Asset {
    return this._library.get(key, this._bundle.namespace);
  }

  /**
   * The non-throwing counterpart to {@link BoundAssetBundle.get}: returns the
   * asset for a declared key, or `null` if the bundle isn't loaded.
   *
   * @param key A declared bundle key.
   * @returns The stored {@link Asset} handle, or `null`.
   */
  public getNullable(key: AssetBundleKey<E>): Asset | null {
    return this._library.getNullable(key, this._bundle.namespace);
  }

  /**
   * Reports whether a declared key is currently loaded.
   *
   * @param key A declared bundle key.
   */
  public has(key: AssetBundleKey<E>): boolean {
    return this._library.has(key, this._bundle.namespace);
  }

  /**
   * Unloads the entire bundle, freeing every entry's underlying resource.
   * Equivalent to {@link AssetLibrary.unloadNamespace} for the bundle's
   * namespace; the canonical "leaving this level" call.
   *
   * @returns A promise that resolves once every resource is freed.
   */
  public unload(): Promise<void> {
    return this._library.unloadNamespace(this._bundle.namespace);
  }
}
