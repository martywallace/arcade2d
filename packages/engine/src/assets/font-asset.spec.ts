import { AssetType } from './asset.constants';
import { FontAsset } from './font-asset';

function fakeFace(family = 'Press Start 2P'): FontFace {
  return { family } as unknown as FontFace;
}

describe('FontAsset', () => {
  test('reports the Font asset type', () => {
    const asset = new FontAsset(
      'pixel',
      'ui',
      'fonts/press-start-2p.ttf',
      fakeFace(),
      'Press Start 2P',
    );

    expect(asset.type).toBe(AssetType.Font);
  });

  test('retains its identity fields', () => {
    const asset = new FontAsset(
      'pixel',
      'ui',
      'fonts/press-start-2p.ttf',
      fakeFace(),
      'Press Start 2P',
    );

    expect(asset.key).toBe('pixel');
    expect(asset.namespace).toBe('ui');
    expect(asset.src).toBe('fonts/press-start-2p.ttf');
  });

  test('exposes the registered family name', () => {
    const asset = new FontAsset(
      'pixel',
      'ui',
      'fonts/press-start-2p.ttf',
      fakeFace(),
      'Press Start 2P',
    );

    expect(asset.family).toBe('Press Start 2P');
  });

  test('exposes the wrapped FontFace via raw for a single-weight load', () => {
    const face = fakeFace();
    const asset = new FontAsset(
      'pixel',
      'ui',
      'fonts/press-start-2p.ttf',
      face,
      'Press Start 2P',
    );

    expect(asset.raw).toBe(face);
  });

  test('exposes the wrapped FontFace array via raw for a multi-weight load', () => {
    const faces = [fakeFace(), fakeFace()];
    const asset = new FontAsset(
      'pixel',
      'ui',
      'fonts/press-start-2p.ttf',
      faces,
      'Press Start 2P',
    );

    expect(asset.raw).toBe(faces);
  });
});
