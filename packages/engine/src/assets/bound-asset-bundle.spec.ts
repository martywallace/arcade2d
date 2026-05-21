import { Assets, Texture } from 'pixi.js';
import { Game } from '../game';
import { AssetType } from './asset.constants';
import { defineAssetBundle } from './asset-bundle.support';
import type { AssetLibrary } from './asset-library';
import { BoundAssetBundle } from './bound-asset-bundle';
import { ImageAsset } from './image-asset';

function fakeTexture(width = 16, height = 16): Texture {
  return { width, height } as unknown as Texture;
}

const level1 = defineAssetBundle('level-1', {
  zombie: 'sprites/zombie.png',
  wall: 'tiles/wall.png',
});

function createLibrary(): AssetLibrary {
  return Game.createHeadless().assets;
}

describe('BoundAssetBundle', () => {
  let unloadSpy: jest.SpyInstance;

  beforeEach(() => {
    jest
      .spyOn(Assets, 'load')
      .mockImplementation(((url: string) =>
        Promise.resolve(
          fakeTexture(url.length, url.length),
        )) as unknown as typeof Assets.load);
    unloadSpy = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('use() returns a handle bound to the bundle namespace', () => {
    const bundle = createLibrary().use(level1);

    expect(bundle).toBeInstanceOf(BoundAssetBundle);
    expect(bundle.namespace).toBe('level-1');
  });

  test('load() loads every entry under its key into the bundle namespace', async () => {
    const assets = createLibrary();
    const bundle = assets.use(level1);

    const loaded = await bundle.load();

    expect(loaded).toHaveLength(2);
    expect(assets.has('zombie', 'level-1')).toBe(true);
    expect(assets.has('wall', 'level-1')).toBe(true);
  });

  test('get() returns a loaded entry by its declared key', async () => {
    const bundle = createLibrary().use(level1);
    await bundle.load();

    const zombie = bundle.get('zombie');

    expect(zombie).toBeInstanceOf(ImageAsset);
    expect(zombie.src).toBe('sprites/zombie.png');
  });

  test('getNullable() returns null before the bundle is loaded', () => {
    const bundle = createLibrary().use(level1);

    expect(bundle.getNullable('zombie')).toBeNull();
  });

  test('has() reflects load state for a declared key', async () => {
    const bundle = createLibrary().use(level1);

    expect(bundle.has('zombie')).toBe(false);
    await bundle.load();
    expect(bundle.has('zombie')).toBe(true);
  });

  test('load() forwards an explicit type so extensionless paths resolve', async () => {
    const assets = createLibrary();
    const cdn = defineAssetBundle('cdn', { hero: 'https://cdn.test/hero' });

    // Without the forwarded type, inference on the extensionless path would
    // reject with ASSET_TYPE_MISMATCH; the explicit type proves it threads.
    const loaded = await assets.use(cdn).load({ type: AssetType.Image });

    expect(loaded).toHaveLength(1);
    expect(assets.has('hero', 'cdn')).toBe(true);
  });

  test('unload() frees the whole bundle namespace', async () => {
    const assets = createLibrary();
    const bundle = assets.use(level1);
    await bundle.load();

    await bundle.unload();

    expect(unloadSpy).toHaveBeenCalledWith([
      'sprites/zombie.png',
      'tiles/wall.png',
    ]);
    expect(bundle.has('zombie')).toBe(false);
  });
});
