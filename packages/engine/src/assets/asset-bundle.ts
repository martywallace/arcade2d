import type { AssetBundleEntries } from './asset-bundle.types';

/**
 * A static, declarative description of a group of assets — a namespace plus a
 * map of friendly key to load path — defined once at module scope and reused
 * wherever those assets are loaded or fetched.
 *
 * An `AssetBundle` is *just data*; it holds no reference to a {@link Game} or
 * {@link AssetLibrary} and performs no loading itself. Bind it to a game's
 * library with {@link AssetLibrary.use} to get a {@link BoundAssetBundle}
 * whose `load` and `get` are wired to that library.
 *
 * The point of declaring assets this way is **compile-time key safety**.
 * Because the bundle captures its keys as literal types (via
 * {@link defineAssetBundle}), {@link BoundAssetBundle.get} only accepts keys
 * the bundle actually declares — a typo'd or never-declared key is a
 * `tsc` error rather than a runtime {@link ErrorCode.ASSET_NOT_FOUND} that
 * only fires when the object using it happens to spawn. This is the
 * intended cure for "a rarely-encountered enemy's graphics component throws
 * deep into a play session because its asset key was wrong."
 *
 * Construct via {@link defineAssetBundle}, not `new` — the factory captures
 * the entry keys as literal types, which the constructor's generic alone
 * cannot.
 *
 * @template E The entry map type, carrying the literal key union.
 *
 * @example
 * ```ts
 * export const level1 = defineAssetBundle('level-1', {
 *   zombie: 'sprites/zombie.png',
 *   wall: 'tiles/wall.png',
 * });
 *
 * const lvl = game.assets.use(level1);
 * await lvl.load();
 * const zombie = lvl.get('zombie'); // 'zombie' | 'wall' — checked by tsc
 * ```
 *
 * @see {@link defineAssetBundle} for the factory.
 * @see {@link BoundAssetBundle} for the library-bound, callable form.
 */
export class AssetBundle<E extends AssetBundleEntries> {
  /**
   * @param namespace The namespace every entry is loaded into and looked up
   * from. Also the unit {@link BoundAssetBundle.unload} frees.
   * @param entries The key-to-path map. Keys are the compile-time-checked
   * argument to {@link BoundAssetBundle.get}; values are loader paths.
   */
  constructor(
    public readonly namespace: string,
    public readonly entries: E,
  ) {}
}
