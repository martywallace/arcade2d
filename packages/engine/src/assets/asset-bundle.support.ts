import { AssetBundle } from './asset-bundle';
import type { AssetBundleEntries } from './asset-bundle.types';

/**
 * Declares an {@link AssetBundle} — the recommended way to group assets for
 * compile-time-safe lookup.
 *
 * The `const` type parameter captures `entries`' keys as their exact literal
 * union, so a bundle bound via {@link AssetLibrary.use} rejects unknown keys
 * at `get` time *during compilation*. Call this at module scope, next to the
 * code that spawns the objects using the assets, and export the result.
 *
 * @param namespace The namespace every entry loads into and is fetched from.
 * One namespace per coarse loading boundary (e.g. one per level) lets
 * {@link BoundAssetBundle.unload} free the whole group at once.
 * @param entries A map of friendly key to load path. Write the keys you want
 * to reference in code; they become the only keys `get` accepts.
 * @returns An {@link AssetBundle} carrying the literal key types.
 *
 * @example
 * ```ts
 * export const ui = defineAssetBundle('ui', {
 *   cursor: 'ui/cursor.png',
 *   heart: 'ui/heart.png',
 * });
 * ```
 */
export function defineAssetBundle<const E extends AssetBundleEntries>(
  namespace: string,
  entries: E,
): AssetBundle<E> {
  return new AssetBundle(namespace, entries);
}
