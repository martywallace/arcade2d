import { AssetType } from './asset.constants';
import { inferAssetType } from './asset.support';

describe('inferAssetType', () => {
  test.each([
    'sprite.png',
    'photo.jpg',
    'photo.jpeg',
    'tiles.webp',
    'anim.gif',
    'modern.avif',
    'legacy.bmp',
    'icon.svg',
  ])('infers Image from the extension of "%s"', (path) => {
    expect(inferAssetType(path)).toBe(AssetType.Image);
  });

  test('is case-insensitive on the extension', () => {
    expect(inferAssetType('SPRITE.PNG')).toBe(AssetType.Image);
  });

  test('ignores a query string when reading the extension', () => {
    expect(inferAssetType('tiles.webp?v=3')).toBe(AssetType.Image);
  });

  test('ignores a hash fragment when reading the extension', () => {
    expect(inferAssetType('icon.svg#frag')).toBe(AssetType.Image);
  });

  test('returns null for a path with no extension', () => {
    expect(inferAssetType('https://cdn.test/hero')).toBeNull();
  });

  test('returns null for an unrecognised extension', () => {
    expect(inferAssetType('track.ogg')).toBeNull();
  });

  test('does not treat a dot in a directory as an extension', () => {
    expect(inferAssetType('./assets/hero')).toBeNull();
  });
});
