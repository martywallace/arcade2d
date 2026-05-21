/**
 * The namespace an {@link Asset} is stored under when a load or lookup does
 * not specify one. Most small games never need more than this single
 * namespace; reach for explicit namespaces (see {@link AssetLoadOptions})
 * once you want to unload a group of assets together — e.g. one namespace
 * per level so {@link AssetLibrary.unloadNamespace} can free the whole level
 * on exit.
 */
export const DEFAULT_ASSET_NAMESPACE = 'default';
