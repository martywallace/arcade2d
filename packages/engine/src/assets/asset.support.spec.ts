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

  describe('data URLs', () => {
    test.each([
      'data:image/png;base64,iVBORw0KGgoAAAANS',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg',
      'data:image/svg+xml;base64,PHN2ZyB4',
      'data:image/webp;base64,UklGRl4',
    ])('infers Image from the MIME type of "%s"', (url) => {
      expect(inferAssetType(url)).toBe(AssetType.Image);
    });

    test('infers Image from a data URL with no base64 marker', () => {
      expect(inferAssetType('data:image/svg+xml,%3Csvg%3E')).toBe(
        AssetType.Image,
      );
    });

    test('is case-insensitive on the MIME type', () => {
      expect(inferAssetType('data:IMAGE/PNG;base64,iVBOR')).toBe(
        AssetType.Image,
      );
    });

    test('reads the whole header when there is no separator', () => {
      // Malformed (no comma/data), but the MIME type alone is enough to infer.
      expect(inferAssetType('data:image/png')).toBe(AssetType.Image);
    });

    test('returns null for a non-image data URL', () => {
      expect(inferAssetType('data:audio/ogg;base64,T2dnUw')).toBeNull();
    });

    test('returns null for a data URL with an empty media type', () => {
      expect(inferAssetType('data:,Hello%2C%20World')).toBeNull();
    });
  });
});
