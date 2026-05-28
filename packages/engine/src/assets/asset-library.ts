import { Assets, Texture } from 'pixi.js';
import { AbstractGameComponent } from '../abstract-game-component';
import { AudioAsset } from '../audio/audio-asset';
import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { Asset } from './asset';
import type { AssetBundle } from './asset-bundle';
import type { AssetBundleEntries } from './asset-bundle.types';
import { AssetType } from './asset.constants';
import { inferAssetType } from './asset.support';
import { DEFAULT_ASSET_NAMESPACE } from './asset-library.constants';
import type {
  AssetConstructor,
  AssetLoadManyOptions,
  AssetLoadOptions,
} from './asset-library.types';
import { BoundAssetBundle } from './bound-asset-bundle';
import { ImageAsset } from './image-asset';

/**
 * Game-tier registry that loads, caches, and hands out {@link Asset}
 * resources — textures today, audio and other kinds later.
 *
 * `AssetLibrary` is auto-attached to every {@link Game} and reached through
 * {@link Game.assets}. It lives at the game tier, not the world tier, because
 * assets outlive worlds: you do not want to reload the player spritesheet
 * every time a world is created or destroyed. Group assets with namespaces
 * (see below) when you want world- or level-scoped *grouping* without
 * world-scoped *lifetime*.
 *
 * Under the hood it wraps PIXI's global `Assets` loader. That dependency is
 * an implementation detail reachable only through {@link AssetLibrary.raw};
 * the surface here speaks in arcade2d {@link Asset} handles.
 *
 * ## Preloading model
 *
 * Loading is **explicit and developer-driven**. There is no lazy
 * load-on-first-use: you preload the assets a phase needs, then run the phase
 * that uses them. The intended granularity is *coarse and eager* — load a
 * whole bundle/namespace at a boundary (entering a level), never one texture
 * per object as it spawns:
 *
 * ```ts
 * await game.assets.loadMany(
 *   ['tiles/floor.png', 'tiles/wall.png', 'sprites/goblin.png'],
 *   { namespace: 'level-1' },
 * );
 * const world = game.createWorld({ ... }); // safe: every asset resolved
 * ```
 *
 * Loading eagerly at a coarse boundary is what makes a missing asset a
 * *load-time* failure ({@link ErrorCode.ASSET_LOAD_FAILED} the moment the
 * batch is awaited) rather than a gameplay-time surprise that only fires if a
 * tester happens to encounter a particular object. {@link AssetLibrary.get}
 * throwing on a missing key is the backstop for the residual "forgot to load
 * the bundle entirely" mistake — not the primary safety net.
 *
 * ## Idempotent loading
 *
 * {@link AssetLibrary.load} is idempotent per `(namespace, key)`. A path
 * already loaded under that identity resolves immediately to the existing
 * handle; a load still in flight returns the same in-flight promise rather
 * than starting a second fetch. Reusing a key for a *different* path within a
 * namespace is a programming error and throws
 * {@link ErrorCode.ASSET_KEY_CONFLICT}.
 *
 * ## Namespaces
 *
 * A namespace is a grouping whose keys are unique only within it. The
 * {@link DEFAULT_ASSET_NAMESPACE} covers the simple case; reach for explicit
 * namespaces when you want {@link AssetLibrary.unloadNamespace} to free a
 * whole group at once (one namespace per level is the canonical use).
 *
 * ## Unloading
 *
 * Unloading is explicit; there is no automatic eviction. Free a single asset
 * with {@link AssetLibrary.unload} or a whole group with
 * {@link AssetLibrary.unloadNamespace}. Both release the underlying GPU
 * resource via the renderer, not just the JS reference — the realistic win
 * is dropping a finished level's textures, or (later) decoded audio buffers.
 *
 * @see {@link Asset} for the resource handle these methods return.
 * @see {@link ImageAsset} for the image/texture specialisation.
 */
export class AssetLibrary extends AbstractGameComponent {
  // Nested by namespace so a namespace is a first-class group: lookups are
  // O(1) and unloadNamespace is a single map delete plus a batched unload.
  private readonly _namespaces = new Map<string, Map<string, Asset>>();

  // In-flight loads keyed by composite (namespace, key). Lets concurrent
  // load() calls for the same identity share one fetch instead of racing.
  private readonly _loading = new Map<string, Promise<Asset>>();

  /**
   * Direct access to the underlying PIXI `Assets` loader.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — registering custom loader parsers, tuning
   * resolver preferences, background-loading, anything we haven't decided how
   * to model yet. Code that touches `raw` is coupled to PIXI's public API and
   * may break when:
   *
   * - arcade2d upgrades PIXI (including minor versions).
   * - PIXI itself ships a breaking change.
   * - arcade2d swaps PIXI for a different loader.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed methods on this component; reach for `raw` only
   * when no equivalent exists, and isolate the access behind your own helper
   * so the coupling is in one place.
   */
  public get raw(): typeof Assets {
    return Assets;
  }

  /**
   * Loads a single resource and stores it for later retrieval by key.
   *
   * Idempotent per `(namespace, key)`: a matching asset that is already
   * loaded resolves immediately, and one still loading returns the shared
   * in-flight promise. See the class docs for the full preloading model.
   *
   * @param path The resource path or URL to load. Resolved by the underlying
   * loader and also retained as the asset's {@link Asset.src} (its unload
   * key).
   * @param options Optional {@link AssetLoadOptions}. `key` defaults to
   * `path`, `namespace` to {@link DEFAULT_ASSET_NAMESPACE}, and `type` to the
   * extension-inferred type.
   * @returns A promise resolving to the stored {@link Asset} handle.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_KEY_CONFLICT} when `(namespace, key)` already
   *   holds an asset loaded from a *different* path.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_TYPE_MISMATCH} when no `type` is given and the
   *   path's extension yields no recognised type.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_LOAD_FAILED} when the underlying loader rejects
   *   (network error, decode failure, unsupported format).
   *
   * @example
   * ```ts
   * const player = await game.assets.load('sprites/player.png', {
   *   key: 'player',
   *   namespace: 'level-1',
   * });
   * ```
   */
  public load(path: string, options: AssetLoadOptions = {}): Promise<Asset> {
    // The synchronous prelude (idempotency + conflict checks) can throw via
    // throwEngineError; convert that into a rejected promise so every failure
    // exit from `load` is asynchronous and callers can rely on a single
    // `await`/`catch` path. The non-throwing branches are returned verbatim
    // so an in-flight load's promise identity is preserved for dedup.
    try {
      return this._beginLoad(path, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Loads many resources in parallel, each stored under its own path as key.
   *
   * The promise resolves once every load settles, with the resulting
   * {@link Asset} handles in the same order as `paths`. If any load rejects,
   * the returned promise rejects with the first error — assets that loaded
   * successfully remain stored.
   *
   * Use this for the eager, coarse-grained preload described in the class
   * docs — load a level's whole asset set in one call before creating the
   * world that uses it.
   *
   * @param paths The resource paths to load. Each becomes both the load
   * source and the storage key; pass {@link AssetLibrary.load} per asset if
   * you need friendly keys.
   * @param options Optional {@link AssetLoadManyOptions} (namespace and/or
   * explicit type) applied to every path in the batch.
   * @returns A promise resolving to the stored {@link Asset} handles, in
   * input order.
   * @throws The same {@link EngineError} codes as {@link AssetLibrary.load},
   *   surfaced from whichever path failed.
   *
   * @example
   * ```ts
   * await game.assets.loadMany(
   *   ['tiles/floor.png', 'tiles/wall.png'],
   *   { namespace: 'level-1' },
   * );
   * ```
   */
  public loadMany(
    paths: readonly string[],
    options: AssetLoadManyOptions = {},
  ): Promise<readonly Asset[]> {
    return Promise.all(paths.map((path) => this.load(path, options)));
  }

  /**
   * Binds a declarative {@link AssetBundle} to this library, returning a
   * {@link BoundAssetBundle} whose `load`/`get`/`unload` are scoped to the
   * bundle's namespace and — crucially — typed to the bundle's declared keys.
   *
   * This is the recommended entry point for any asset whose key is known at
   * authoring time. Where the untyped {@link AssetLibrary.get} accepts any
   * string and throws {@link ErrorCode.ASSET_NOT_FOUND} at runtime on a typo,
   * a bound bundle rejects an unknown key at compile time — turning "a rare
   * object's graphics component throws mid-session because its asset key was
   * wrong" into a `tsc` error. Keep the untyped methods for genuinely dynamic
   * keys.
   *
   * @param bundle An {@link AssetBundle} from {@link defineAssetBundle}.
   * @returns A {@link BoundAssetBundle} bound to this library.
   *
   * @example
   * ```ts
   * const lvl = game.assets.use(level1);
   * await lvl.load();
   * const zombie = lvl.get('zombie'); // typed to the bundle's keys
   * ```
   */
  public use<E extends AssetBundleEntries>(
    bundle: AssetBundle<E>,
  ): BoundAssetBundle<E> {
    return new BoundAssetBundle(this, bundle);
  }

  /**
   * Retrieves a previously loaded or stored asset by key.
   *
   * Throws on a miss rather than returning `null` — a missing asset at this
   * point means the expected preload never ran, which is a programming error
   * the engine surfaces loudly. Use {@link AssetLibrary.getNullable} when
   * absence is a legitimate, handled state.
   *
   * @param key The key the asset was stored under.
   * @param namespace The namespace to look in. Defaults to
   * {@link DEFAULT_ASSET_NAMESPACE}.
   * @returns The stored {@link Asset} handle.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_NOT_FOUND} when no asset is stored under
   *   `(namespace, key)`.
   *
   * @example
   * ```ts
   * const player = game.assets.get('player') as ImageAsset;
   * ```
   */
  public get(key: string, namespace: string = DEFAULT_ASSET_NAMESPACE): Asset {
    const asset = this.getNullable(key, namespace);

    if (!asset) {
      throwEngineError(
        ErrorCode.ASSET_NOT_FOUND,
        `No asset "${key}" in namespace "${namespace}". It was likely never ` +
          `preloaded — load it (or its bundle) before the code that needs it ` +
          `runs.`,
        { key, namespace },
      );
    }

    return asset;
  }

  /**
   * Retrieves an asset by key and asserts its concrete type, returning it
   * typed — so call sites avoid an unchecked `as ImageAsset` cast.
   *
   * Pass the expected {@link Asset} subclass (e.g. {@link ImageAsset}) as a
   * runtime witness; the lookup verifies the stored asset is an instance of
   * it. This mirrors {@link ComponentHost.getComponentByType} and, unlike a
   * bare `get<T>()` generic, is **type-safe at runtime**: a wrong type is a
   * loud {@link ErrorCode.ASSET_TYPE_MISMATCH}, not a latent mis-cast.
   *
   * @param key The key the asset was stored under.
   * @param type The expected concrete {@link Asset} subclass constructor.
   * @param namespace The namespace to look in. Defaults to
   * {@link DEFAULT_ASSET_NAMESPACE}.
   * @returns The stored asset, typed as `T`.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_NOT_FOUND} when no asset is stored under
   *   `(namespace, key)`.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_TYPE_MISMATCH} when the stored asset is not an
   *   instance of `type`.
   *
   * @example
   * ```ts
   * const player = game.assets.getAs('player', ImageAsset); // typed, no cast
   * new Texture(player);
   * ```
   */
  public getAs<T extends Asset>(
    key: string,
    type: AssetConstructor<T>,
    namespace: string = DEFAULT_ASSET_NAMESPACE,
  ): T {
    const asset = this.get(key, namespace);

    if (!(asset instanceof type)) {
      throwEngineError(
        ErrorCode.ASSET_TYPE_MISMATCH,
        `Asset "${key}" in namespace "${namespace}" is a "${asset.type}" ` +
          `asset, not the expected ${type.name}.`,
        { key, namespace, expected: type.name, actualType: asset.type },
      );
    }

    return asset;
  }

  /**
   * Retrieves a previously loaded or stored asset by key, or `null` if none
   * is stored under `(namespace, key)`.
   *
   * The non-throwing counterpart to {@link AssetLibrary.get}; mirrors the
   * `getNullableComponent` convention on the component host. Use it when
   * absence is an expected, handled outcome rather than a programming error.
   *
   * @param key The key the asset was stored under.
   * @param namespace The namespace to look in. Defaults to
   * {@link DEFAULT_ASSET_NAMESPACE}.
   * @returns The stored {@link Asset} handle, or `null`.
   */
  public getNullable(
    key: string,
    namespace: string = DEFAULT_ASSET_NAMESPACE,
  ): Asset | null {
    return this._namespaces.get(namespace)?.get(key) ?? null;
  }

  /**
   * Registers an externally-produced {@link Asset} under a key, without going
   * through the loader.
   *
   * This is the entry point for assets the engine did not fetch — a texture
   * generated at runtime, a render-texture snapshot, a procedurally-built
   * resource. {@link AssetLibrary.load} also routes through `store` once its
   * fetch resolves, so a stored asset is indistinguishable from a loaded one
   * at lookup time.
   *
   * @param key The key to store the asset under. Unique per namespace.
   * @param asset The {@link Asset} handle to register.
   * @param namespace The namespace to store under. Defaults to
   * {@link DEFAULT_ASSET_NAMESPACE}.
   * @returns The same `asset`, for call-site convenience.
   * @throws {@link EngineError} with code
   *   {@link ErrorCode.ASSET_KEY_CONFLICT} when `(namespace, key)` already
   *   holds a *different* asset. Re-storing the identical instance is a
   *   no-op and does not throw.
   */
  public store(
    key: string,
    asset: Asset,
    namespace: string = DEFAULT_ASSET_NAMESPACE,
  ): Asset {
    let bucket = this._namespaces.get(namespace);

    if (!bucket) {
      bucket = new Map<string, Asset>();
      this._namespaces.set(namespace, bucket);
    }

    const existing = bucket.get(key);
    if (existing && existing !== asset) {
      throwEngineError(
        ErrorCode.ASSET_KEY_CONFLICT,
        `Cannot store asset as "${key}" in namespace "${namespace}" — that ` +
          `key already holds a different asset. Keys must be unique per ` +
          `namespace.`,
        { key, namespace },
      );
    }

    bucket.set(key, asset);
    return asset;
  }

  /**
   * Reports whether an asset is stored under `(namespace, key)`.
   *
   * @param key The key to check for.
   * @param namespace The namespace to look in. Defaults to
   * {@link DEFAULT_ASSET_NAMESPACE}.
   */
  public has(
    key: string,
    namespace: string = DEFAULT_ASSET_NAMESPACE,
  ): boolean {
    return this.getNullable(key, namespace) !== null;
  }

  /**
   * Unloads a single asset, releasing its underlying GPU/loader resource and
   * dropping it from the library.
   *
   * Idempotent: unloading a key that isn't stored is a no-op, like
   * `removeComponent` on the component host. After this resolves,
   * {@link AssetLibrary.get} for the same key throws again until it is
   * reloaded.
   *
   * @param key The key of the asset to unload.
   * @param namespace The namespace it lives in. Defaults to
   * {@link DEFAULT_ASSET_NAMESPACE}.
   * @returns A promise that resolves once the underlying resource is freed.
   */
  public async unload(
    key: string,
    namespace: string = DEFAULT_ASSET_NAMESPACE,
  ): Promise<void> {
    const bucket = this._namespaces.get(namespace);
    const asset = bucket?.get(key);

    if (!bucket || !asset) {
      return;
    }

    bucket.delete(key);
    if (bucket.size === 0) {
      this._namespaces.delete(namespace);
    }

    // Audio assets are decoded buffers held in JS memory — there's no
    // renderer-side cache to invalidate, so they only need to be dropped
    // from the library. Image assets do go through the PIXI loader and
    // need its `unload` call to free the GPU texture.
    if (asset.type === AssetType.Image) {
      await Assets.unload(asset.src);
    }
  }

  /**
   * Unloads every asset in a namespace in one batch, releasing all of their
   * underlying resources and dropping the namespace.
   *
   * This is the coarse-grained eviction the namespace model is built for:
   * give a level its own namespace, then drop the whole set on exit.
   * Idempotent — unloading an unknown or already-empty namespace is a no-op.
   *
   * @param namespace The namespace to clear.
   * @returns A promise that resolves once every underlying resource is freed.
   *
   * @example
   * ```ts
   * await game.assets.unloadNamespace('level-1'); // entering level 2
   * ```
   */
  public async unloadNamespace(namespace: string): Promise<void> {
    const bucket = this._namespaces.get(namespace);

    if (!bucket) {
      return;
    }

    const imageSources = [...bucket.values()]
      .filter((asset) => asset.type === AssetType.Image)
      .map((asset) => asset.src);
    this._namespaces.delete(namespace);

    if (imageSources.length > 0) {
      await Assets.unload(imageSources);
    }
  }

  /**
   * Drops every tracked asset reference when the game tears down. The
   * underlying GPU resources are released by the PIXI application's own
   * `destroy` during {@link Game.destroy}, so this only needs to clear the
   * library's bookkeeping.
   */
  public override onDestroy(): void {
    this._namespaces.clear();
    this._loading.clear();
  }

  /**
   * Synchronous core of {@link AssetLibrary.load}: resolves the key and
   * namespace, short-circuits already-loaded and in-flight requests, and
   * otherwise kicks off (and registers) a fresh load. May throw on a key
   * conflict; {@link AssetLibrary.load} converts that into a rejection.
   */
  private _beginLoad(path: string, options: AssetLoadOptions): Promise<Asset> {
    const key = options.key ?? path;
    const namespace = options.namespace ?? DEFAULT_ASSET_NAMESPACE;

    const existing = this.getNullable(key, namespace);
    if (existing) {
      if (existing.src !== path) {
        throwEngineError(
          ErrorCode.ASSET_KEY_CONFLICT,
          `Cannot load "${path}" as "${key}" in namespace "${namespace}" — ` +
            `that key already holds a different asset (loaded from ` +
            `"${existing.src}"). Keys must be unique per namespace.`,
          { path, key, namespace, existingSrc: existing.src },
        );
      }
      return Promise.resolve(existing);
    }

    const compositeKey = this._compositeKey(key, namespace);
    const inFlight = this._loading.get(compositeKey);
    if (inFlight) {
      return inFlight;
    }

    const promise = this._performLoad(
      path,
      key,
      namespace,
      options.type,
    ).finally(() => this._loading.delete(compositeKey));

    this._loading.set(compositeKey, promise);
    return promise;
  }

  /**
   * Performs the actual fetch-and-wrap for a single asset. Split out from
   * {@link AssetLibrary.load} so the public method stays focused on the
   * idempotency bookkeeping and this method owns type resolution, the loader
   * call, and error translation.
   */
  private async _performLoad(
    path: string,
    key: string,
    namespace: string,
    explicitType: AssetType | undefined,
  ): Promise<Asset> {
    const type = explicitType ?? inferAssetType(path);

    if (type === null) {
      throwEngineError(
        ErrorCode.ASSET_TYPE_MISMATCH,
        `Cannot infer an asset type for "${path}" — its extension is missing ` +
          `or unrecognised. Pass an explicit \`type\` in the load options.`,
        { path, key, namespace },
      );
    }

    // No default branch: the switch is exhaustive over AssetType, so adding
    // a new member without wiring its load path here is a compile error
    // rather than a silent runtime fallthrough.
    switch (type) {
      case AssetType.Image: {
        const texture = await this._loadTexture(path, key, namespace);
        return this.store(
          key,
          new ImageAsset(key, namespace, path, texture),
          namespace,
        );
      }
      case AssetType.Audio: {
        const buffer = await this._loadAudioBuffer(path, key, namespace);
        return this.store(
          key,
          new AudioAsset(key, namespace, path, buffer),
          namespace,
        );
      }
    }
  }

  /**
   * Calls the underlying loader for an image, translating any loader
   * rejection into an {@link EngineError} so callers see the engine's error
   * contract rather than a raw PIXI failure.
   */
  private async _loadTexture(
    path: string,
    key: string,
    namespace: string,
  ): Promise<Texture> {
    try {
      return await Assets.load<Texture>(path);
    } catch (cause) {
      return throwEngineError(
        ErrorCode.ASSET_LOAD_FAILED,
        `Failed to load image "${path}" (key "${key}", namespace ` +
          `"${namespace}"). See the \`cause\` in context for the underlying ` +
          `loader error.`,
        { path, key, namespace, cause },
      );
    }
  }

  /**
   * Calls the game's {@link AudioEngine} to fetch and decode an audio clip,
   * translating any failure into an {@link EngineError} so callers see the
   * engine's error contract rather than a raw `fetch` / `decodeAudioData`
   * failure. An {@link ErrorCode.AUDIO_UNAVAILABLE} thrown by the engine in
   * headless mode is propagated unchanged.
   */
  private async _loadAudioBuffer(
    path: string,
    key: string,
    namespace: string,
  ): Promise<AudioBuffer> {
    try {
      return await this.host.audio.loadAudioBuffer(path);
    } catch (cause) {
      if (cause instanceof EngineError) {
        throw cause;
      }
      return throwEngineError(
        ErrorCode.ASSET_LOAD_FAILED,
        `Failed to load audio "${path}" (key "${key}", namespace ` +
          `"${namespace}"). See the \`cause\` in context for the underlying ` +
          `loader error.`,
        { path, key, namespace, cause },
      );
    }
  }

  /**
   * Builds the composite map key for the in-flight load registry. Uses a NUL
   * separator so it can't collide with any namespace or key a developer would
   * realistically type.
   */
  private _compositeKey(key: string, namespace: string): string {
    return `${namespace} ${key}`;
  }
}
