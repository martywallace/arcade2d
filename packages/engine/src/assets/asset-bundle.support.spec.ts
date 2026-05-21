import { AssetBundle } from './asset-bundle';
import { defineAssetBundle } from './asset-bundle.support';

describe('defineAssetBundle', () => {
  test('produces an AssetBundle carrying the namespace and entries', () => {
    const bundle = defineAssetBundle('level-1', {
      zombie: 'sprites/zombie.png',
      wall: 'tiles/wall.png',
    });

    expect(bundle).toBeInstanceOf(AssetBundle);
    expect(bundle.namespace).toBe('level-1');
    expect(bundle.entries).toEqual({
      zombie: 'sprites/zombie.png',
      wall: 'tiles/wall.png',
    });
  });
});
