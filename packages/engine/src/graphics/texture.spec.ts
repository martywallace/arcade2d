import { Texture as PixiTexture, TextureSource } from 'pixi.js';
import { ImageAsset } from '../assets';
import { Texture } from './texture';

function imageAsset(width = 64, height = 64): ImageAsset {
  const source = new TextureSource({ width, height });
  const raw = new PixiTexture({ source });

  return new ImageAsset('sheet', 'default', 'sheet.png', raw);
}

describe('Texture', () => {
  describe('whole image', () => {
    test('reuses the asset texture and has no frame', () => {
      const asset = imageAsset(64, 32);
      const texture = new Texture(asset);

      expect(texture.frame).toBeNull();
      expect(texture.raw).toBe(asset.raw);
      expect(texture.asset).toBe(asset);
      expect(texture.width).toBe(64);
      expect(texture.height).toBe(32);
    });
  });

  describe('framed sub-region', () => {
    test('creates a sub-texture sized to the frame', () => {
      const asset = imageAsset(64, 64);
      const frame = { x: 16, y: 8, width: 16, height: 24 };
      const texture = new Texture(asset, frame);

      expect(texture.frame).toBe(frame);
      expect(texture.raw).not.toBe(asset.raw);
      expect(texture.width).toBe(16);
      expect(texture.height).toBe(24);
    });

    test('shares the asset texture source', () => {
      const asset = imageAsset();
      const texture = new Texture(asset, { x: 0, y: 0, width: 8, height: 8 });

      expect(texture.raw.source).toBe(asset.raw.source);
    });
  });

  describe('grid', () => {
    test('slices row-major and returns one texture per cell', () => {
      const asset = imageAsset(64, 64);

      const textures = Texture.grid(asset, {
        frameWidth: 16,
        frameHeight: 16,
        columns: 2,
        rows: 2,
      });

      expect(textures).toHaveLength(4);
      expect(textures.map((texture) => texture.frame)).toEqual([
        { x: 0, y: 0, width: 16, height: 16 },
        { x: 16, y: 0, width: 16, height: 16 },
        { x: 0, y: 16, width: 16, height: 16 },
        { x: 16, y: 16, width: 16, height: 16 },
      ]);
    });

    test('applies offset and spacing', () => {
      const asset = imageAsset(128, 128);

      const textures = Texture.grid(asset, {
        frameWidth: 16,
        frameHeight: 16,
        columns: 2,
        rows: 1,
        offsetX: 4,
        offsetY: 2,
        spacingX: 8,
        spacingY: 8,
      });

      expect(textures.map((texture) => texture.frame)).toEqual([
        { x: 4, y: 2, width: 16, height: 16 },
        { x: 28, y: 2, width: 16, height: 16 },
      ]);
    });

    test('caps the frame count and clamps it to the grid size', () => {
      const asset = imageAsset(64, 64);

      const capped = Texture.grid(asset, {
        frameWidth: 16,
        frameHeight: 16,
        columns: 4,
        rows: 4,
        count: 3,
      });
      const overCapped = Texture.grid(asset, {
        frameWidth: 16,
        frameHeight: 16,
        columns: 2,
        rows: 1,
        count: 99,
      });

      expect(capped).toHaveLength(3);
      expect(overCapped).toHaveLength(2);
    });
  });
});
