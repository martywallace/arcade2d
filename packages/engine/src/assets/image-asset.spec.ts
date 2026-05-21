import { Texture } from 'pixi.js';
import { AssetType } from './asset.constants';
import { ImageAsset } from './image-asset';

function fakeTexture(width = 32, height = 48): Texture {
  return { width, height } as unknown as Texture;
}

describe('ImageAsset', () => {
  test('reports the Image asset type', () => {
    const asset = new ImageAsset(
      'player',
      'level-1',
      'player.png',
      fakeTexture(),
    );

    expect(asset.type).toBe(AssetType.Image);
  });

  test('retains its identity fields', () => {
    const asset = new ImageAsset(
      'player',
      'level-1',
      'sprites/player.png',
      fakeTexture(),
    );

    expect(asset.key).toBe('player');
    expect(asset.namespace).toBe('level-1');
    expect(asset.src).toBe('sprites/player.png');
  });

  test('exposes the wrapped texture via raw', () => {
    const texture = fakeTexture();
    const asset = new ImageAsset('player', 'default', 'player.png', texture);

    expect(asset.raw).toBe(texture);
  });

  test('surfaces the texture dimensions as width and height', () => {
    const asset = new ImageAsset(
      'player',
      'default',
      'player.png',
      fakeTexture(64, 96),
    );

    expect(asset.width).toBe(64);
    expect(asset.height).toBe(96);
  });
});
