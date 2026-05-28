import { Assets, Texture } from 'pixi.js';
import { AudioAsset } from '../audio/audio-asset';
import { AudioEngine } from '../audio/audio-engine';
import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Game } from '../game';
import { Asset } from './asset';
import { AssetLibrary } from './asset-library';
import { AssetType } from './asset.constants';
import { FontAsset } from './font-asset';
import { ImageAsset } from './image-asset';

/** A non-image asset used to exercise the getAs type-mismatch path. */
class OtherAsset extends Asset {
  public readonly type = AssetType.Image;
}

function fakeTexture(width = 16, height = 16): Texture {
  return { width, height } as unknown as Texture;
}

function mockLoad(impl: (url: string) => Promise<Texture>): jest.SpyInstance {
  return jest
    .spyOn(Assets, 'load')
    .mockImplementation(impl as unknown as typeof Assets.load);
}

function createLibrary(): AssetLibrary {
  return Game.createHeadless().assets;
}

async function captureError(promise: Promise<unknown>): Promise<EngineError> {
  try {
    await promise;
  } catch (error) {
    return error as EngineError;
  }

  throw new Error('expected the promise to reject, but it resolved');
}

describe('AssetLibrary', () => {
  let unloadSpy: jest.SpyInstance;

  beforeEach(() => {
    mockLoad((url) => Promise.resolve(fakeTexture(url.length, url.length)));
    unloadSpy = jest.spyOn(Assets, 'unload').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('wiring', () => {
    test('is auto-attached to every Game and reachable via game.assets', () => {
      expect(createLibrary()).toBeInstanceOf(AssetLibrary);
    });

    test('raw exposes the underlying PIXI Assets loader', () => {
      expect(createLibrary().raw).toBe(Assets);
    });
  });

  describe('load', () => {
    test('loads an image and stores it under its path by default', async () => {
      const assets = createLibrary();

      const asset = await assets.load('sprites/player.png');

      expect(asset).toBeInstanceOf(ImageAsset);
      expect(asset.type).toBe(AssetType.Image);
      expect(asset.src).toBe('sprites/player.png');
      expect(assets.get('sprites/player.png')).toBe(asset);
    });

    test('honours an explicit key and namespace', async () => {
      const assets = createLibrary();

      await assets.load('sprites/player.png', {
        key: 'player',
        namespace: 'level-1',
      });

      expect(assets.has('player', 'level-1')).toBe(true);
      expect(assets.getNullable('sprites/player.png')).toBeNull();
    });

    test('is idempotent for an already-loaded key', async () => {
      const assets = createLibrary();

      const first = await assets.load('a.png');
      const second = await assets.load('a.png');

      expect(second).toBe(first);
      expect(Assets.load).toHaveBeenCalledTimes(1);
    });

    test('shares a single in-flight fetch for concurrent loads', async () => {
      const assets = createLibrary();
      let resolveLoad!: (texture: Texture) => void;
      mockLoad(
        () => new Promise<Texture>((resolve) => (resolveLoad = resolve)),
      );

      const first = assets.load('a.png');
      const second = assets.load('a.png');

      expect(first).toBe(second);
      expect(Assets.load).toHaveBeenCalledTimes(1);

      resolveLoad(fakeTexture());
      await Promise.all([first, second]);
    });

    test('throws ASSET_KEY_CONFLICT when a key is reused for a different path', async () => {
      const assets = createLibrary();
      await assets.load('a.png', { key: 'shared' });

      const error = await captureError(assets.load('b.png', { key: 'shared' }));

      expect(error).toBeInstanceOf(EngineError);
      expect(error.code).toBe(ErrorCode.ASSET_KEY_CONFLICT);
    });

    test('throws ASSET_TYPE_MISMATCH when the type cannot be inferred', async () => {
      const assets = createLibrary();

      const error = await captureError(assets.load('https://cdn.test/hero'));

      expect(error.code).toBe(ErrorCode.ASSET_TYPE_MISMATCH);
    });

    test('accepts an explicit type for an extensionless path', async () => {
      const assets = createLibrary();

      const asset = await assets.load('https://cdn.test/hero', {
        key: 'hero',
        type: AssetType.Image,
      });

      expect(asset).toBeInstanceOf(ImageAsset);
      expect(Assets.load).toHaveBeenCalledTimes(1);
    });

    test('throws ASSET_LOAD_FAILED and keeps the loader error as cause', async () => {
      const assets = createLibrary();
      const loaderError = new Error('404');
      mockLoad(() => Promise.reject(loaderError));

      const error = await captureError(assets.load('missing.png'));

      expect(error.code).toBe(ErrorCode.ASSET_LOAD_FAILED);
      expect(error.context?.cause).toBe(loaderError);
    });
  });

  describe('loadMany', () => {
    test('loads every path and returns the assets in input order', async () => {
      const assets = createLibrary();

      const loaded = await assets.loadMany(['a.png', 'b.png', 'c.png'], {
        namespace: 'batch',
      });

      expect(loaded.map((asset) => asset.src)).toEqual([
        'a.png',
        'b.png',
        'c.png',
      ]);
      expect(assets.has('a.png', 'batch')).toBe(true);
    });

    test('defaults to the default namespace when no options are given', async () => {
      const assets = createLibrary();

      await assets.loadMany(['a.png']);

      expect(assets.has('a.png')).toBe(true);
    });
  });

  describe('get / getNullable', () => {
    test('throws ASSET_NOT_FOUND for an unknown key', () => {
      const assets = createLibrary();

      let thrown: EngineError | null = null;
      try {
        assets.get('nope');
      } catch (error) {
        thrown = error as EngineError;
      }

      expect(thrown).toBeInstanceOf(EngineError);
      expect(thrown?.code).toBe(ErrorCode.ASSET_NOT_FOUND);
    });

    test('getNullable returns null for an unknown key', () => {
      expect(createLibrary().getNullable('nope')).toBeNull();
    });
  });

  describe('getAs', () => {
    test('returns the asset typed when the type matches', async () => {
      const assets = createLibrary();
      await assets.load('a.png');

      const asset = assets.getAs('a.png', ImageAsset);

      expect(asset).toBeInstanceOf(ImageAsset);
    });

    test('throws ASSET_TYPE_MISMATCH when the stored type differs', () => {
      const assets = createLibrary();
      assets.store('x', new OtherAsset('x', 'default', 'x.png'));

      let thrown: EngineError | null = null;
      try {
        assets.getAs('x', ImageAsset);
      } catch (error) {
        thrown = error as EngineError;
      }

      expect(thrown).toBeInstanceOf(EngineError);
      expect(thrown?.code).toBe(ErrorCode.ASSET_TYPE_MISMATCH);
    });

    test('propagates ASSET_NOT_FOUND for an unknown key', () => {
      const assets = createLibrary();

      let thrown: EngineError | null = null;
      try {
        assets.getAs('nope', ImageAsset);
      } catch (error) {
        thrown = error as EngineError;
      }

      expect(thrown?.code).toBe(ErrorCode.ASSET_NOT_FOUND);
    });
  });

  describe('store', () => {
    test('registers an externally-produced asset and returns it', () => {
      const assets = createLibrary();
      const asset = new ImageAsset('gen', 'default', 'gen', fakeTexture());

      expect(assets.store('gen', asset)).toBe(asset);
      expect(assets.get('gen')).toBe(asset);
    });

    test('re-storing the identical instance is a no-op', () => {
      const assets = createLibrary();
      const asset = new ImageAsset('gen', 'default', 'gen', fakeTexture());
      assets.store('gen', asset);

      expect(() => assets.store('gen', asset)).not.toThrow();
    });

    test('throws ASSET_KEY_CONFLICT on a different asset under the same key', () => {
      const assets = createLibrary();
      assets.store('gen', new ImageAsset('gen', 'default', 'a', fakeTexture()));

      expect(() =>
        assets.store(
          'gen',
          new ImageAsset('gen', 'default', 'b', fakeTexture()),
        ),
      ).toThrow(EngineError);
    });
  });

  describe('has', () => {
    test('reflects whether an asset is stored', async () => {
      const assets = createLibrary();

      expect(assets.has('a.png')).toBe(false);
      await assets.load('a.png');
      expect(assets.has('a.png')).toBe(true);
    });
  });

  describe('unload', () => {
    test('frees the underlying resource and forgets the asset', async () => {
      const assets = createLibrary();
      const asset = await assets.load('a.png');

      await assets.unload('a.png');

      expect(unloadSpy).toHaveBeenCalledWith(asset.src);
      expect(assets.getNullable('a.png')).toBeNull();
    });

    test('is a no-op for an unknown key', async () => {
      const assets = createLibrary();
      await assets.load('a.png');

      await assets.unload('missing');

      expect(unloadSpy).not.toHaveBeenCalled();
    });

    test('is a no-op for an unknown namespace', async () => {
      const assets = createLibrary();

      await assets.unload('a.png', 'nope');

      expect(unloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('unloadNamespace', () => {
    test('frees every asset in the namespace in one batch', async () => {
      const assets = createLibrary();
      await assets.loadMany(['a.png', 'b.png'], { namespace: 'level-1' });

      await assets.unloadNamespace('level-1');

      expect(unloadSpy).toHaveBeenCalledWith(['a.png', 'b.png']);
      expect(assets.has('a.png', 'level-1')).toBe(false);
      expect(assets.has('b.png', 'level-1')).toBe(false);
    });

    test('is a no-op for an unknown namespace', async () => {
      const assets = createLibrary();

      await assets.unloadNamespace('nope');

      expect(unloadSpy).not.toHaveBeenCalled();
    });
  });

  describe('onDestroy', () => {
    test('drops every tracked asset reference', async () => {
      const assets = createLibrary();
      await assets.load('a.png');

      assets.onDestroy();

      expect(assets.getNullable('a.png')).toBeNull();
    });
  });

  describe('audio loads', () => {
    const fakeBuffer = (): AudioBuffer =>
      ({
        duration: 2,
        numberOfChannels: 2,
        sampleRate: 44_100,
      }) as unknown as AudioBuffer;

    test('produces an AudioAsset wrapping the decoded buffer', async () => {
      const buffer = fakeBuffer();
      const game = Game.createHeadless();
      jest
        .spyOn(AudioEngine.prototype, 'loadAudioBuffer')
        .mockResolvedValue(buffer);

      const asset = await game.assets.load('theme.ogg');

      expect(asset).toBeInstanceOf(AudioAsset);
      expect(asset.type).toBe(AssetType.Audio);
      expect((asset as AudioAsset).raw).toBe(buffer);
      expect(asset.src).toBe('theme.ogg');
    });

    test('honours an explicit Audio type for an extensionless path', async () => {
      jest
        .spyOn(AudioEngine.prototype, 'loadAudioBuffer')
        .mockResolvedValue(fakeBuffer());

      const game = Game.createHeadless();
      const asset = await game.assets.load('https://cdn.test/theme', {
        key: 'theme',
        type: AssetType.Audio,
      });

      expect(asset).toBeInstanceOf(AudioAsset);
    });

    test('propagates AUDIO_UNAVAILABLE when the engine is headless', async () => {
      const game = Game.createHeadless();

      const error = await captureError(game.assets.load('theme.ogg'));

      expect(error).toBeInstanceOf(EngineError);
      expect(error.code).toBe(ErrorCode.AUDIO_UNAVAILABLE);
    });

    test('wraps non-EngineError failures as ASSET_LOAD_FAILED', async () => {
      const cause = new Error('decode failure');
      jest
        .spyOn(AudioEngine.prototype, 'loadAudioBuffer')
        .mockRejectedValue(cause);

      const game = Game.createHeadless();
      const error = await captureError(game.assets.load('theme.ogg'));

      expect(error.code).toBe(ErrorCode.ASSET_LOAD_FAILED);
      expect(error.context?.cause).toBe(cause);
    });

    test('unload does not call PIXI Assets.unload for audio', async () => {
      jest
        .spyOn(AudioEngine.prototype, 'loadAudioBuffer')
        .mockResolvedValue(fakeBuffer());

      const game = Game.createHeadless();
      await game.assets.load('theme.ogg');
      const calls = unloadSpy.mock.calls.length;

      await game.assets.unload('theme.ogg');

      expect(unloadSpy.mock.calls.length).toBe(calls);
      expect(game.assets.getNullable('theme.ogg')).toBeNull();
    });

    test('unloadNamespace skips audio sources but still frees images', async () => {
      jest
        .spyOn(AudioEngine.prototype, 'loadAudioBuffer')
        .mockResolvedValue(fakeBuffer());

      const game = Game.createHeadless();
      await game.assets.load('theme.ogg', { namespace: 'level-1' });
      await game.assets.load('hero.png', { namespace: 'level-1' });

      await game.assets.unloadNamespace('level-1');

      expect(unloadSpy).toHaveBeenCalledWith(['hero.png']);
      expect(game.assets.has('theme.ogg', 'level-1')).toBe(false);
      expect(game.assets.has('hero.png', 'level-1')).toBe(false);
    });
  });

  describe('font loads', () => {
    const fakeFace = (family = 'Press Start 2P'): FontFace =>
      ({ family }) as unknown as FontFace;

    test('produces a FontAsset wrapping the loaded FontFace', async () => {
      const face = fakeFace();
      mockLoad(() => Promise.resolve(face as unknown as Texture));

      const assets = createLibrary();
      const asset = await assets.load('fonts/press-start-2p.ttf', {
        key: 'pixel',
      });

      expect(asset).toBeInstanceOf(FontAsset);
      expect(asset.type).toBe(AssetType.Font);
      expect((asset as FontAsset).raw).toBe(face);
      expect((asset as FontAsset).family).toBe('Press Start 2P');
    });

    test('takes the family from the first face when the loader returns an array', async () => {
      const faces = [fakeFace('Inter'), fakeFace('Inter')];
      mockLoad(() => Promise.resolve(faces as unknown as Texture));

      const assets = createLibrary();
      const asset = await assets.load('fonts/inter.woff2', { key: 'body' });

      expect((asset as FontAsset).family).toBe('Inter');
      expect((asset as FontAsset).raw).toBe(faces);
    });

    test('throws ASSET_LOAD_FAILED when the loader rejects', async () => {
      const cause = new Error('404');
      mockLoad(() => Promise.reject(cause));

      const assets = createLibrary();
      const error = await captureError(
        assets.load('fonts/missing.woff2', { key: 'missing' }),
      );

      expect(error.code).toBe(ErrorCode.ASSET_LOAD_FAILED);
      expect(error.context?.cause).toBe(cause);
    });

    test('unload frees the FontFace via PIXI Assets.unload', async () => {
      mockLoad(() => Promise.resolve(fakeFace() as unknown as Texture));
      const assets = createLibrary();
      await assets.load('fonts/press-start-2p.ttf', { key: 'pixel' });

      await assets.unload('pixel');

      expect(unloadSpy).toHaveBeenCalledWith('fonts/press-start-2p.ttf');
      expect(assets.getNullable('pixel')).toBeNull();
    });

    test('throws ASSET_LOAD_FAILED when the loader returns no FontFaces', async () => {
      mockLoad(() => Promise.resolve([] as unknown as Texture));

      const assets = createLibrary();
      const error = await captureError(
        assets.load('fonts/empty.woff2', { key: 'empty' }),
      );

      expect(error.code).toBe(ErrorCode.ASSET_LOAD_FAILED);
    });

    test('unloadNamespace batches font sources alongside image sources', async () => {
      mockLoad((url) =>
        url.endsWith('.ttf')
          ? Promise.resolve(fakeFace() as unknown as Texture)
          : Promise.resolve(fakeTexture()),
      );
      const assets = createLibrary();
      await assets.load('hero.png', { namespace: 'level-1' });
      await assets.load('fonts/press-start-2p.ttf', {
        key: 'pixel',
        namespace: 'level-1',
      });

      await assets.unloadNamespace('level-1');

      expect(unloadSpy).toHaveBeenCalledWith([
        'hero.png',
        'fonts/press-start-2p.ttf',
      ]);
    });
  });
});
