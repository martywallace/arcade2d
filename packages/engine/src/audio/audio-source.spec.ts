import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Game } from '../game';
import { World } from '../world/world';
import type { WorldObject } from '../world/world-object';
import { AudioAsset } from './audio-asset';
import { AudioSource } from './audio-source';
import {
  installFakeAudioContext,
  StubAudioContext,
} from './fake-audio-context';

function fakeAsset(key = 'shot', src = 'shot.ogg'): AudioAsset {
  const buffer = {
    duration: 1,
    numberOfChannels: 1,
    sampleRate: 44_100,
  } as unknown as AudioBuffer;
  return new AudioAsset(key, 'default', src, buffer);
}

function setup(asset: AudioAsset | null = fakeAsset()): {
  world: World;
  obj: WorldObject;
  source: AudioSource;
} {
  const world = new World(Game.createHeadless(), { components: () => ({}) });
  const obj = world.createEmpty();
  const source = new AudioSource(obj, asset);
  obj.addComponent('audio', source);
  return { world, obj, source };
}

describe('AudioSource', () => {
  describe('without a faked context (headless)', () => {
    test('plays a voice using the default asset and tracks it', () => {
      const { source } = setup();

      const voice = source.play();
      expect(voice.playing).toBe(true);
      expect(source.activeVoiceCount).toBe(1);
    });

    test('play throws AUDIO_NO_SOURCE when no asset is set or supplied', () => {
      const { source } = setup(null);

      let error: EngineError | null = null;
      try {
        source.play();
      } catch (caught) {
        error = caught as EngineError;
      }
      expect(error).toBeInstanceOf(EngineError);
      expect(error?.code).toBe(ErrorCode.AUDIO_NO_SOURCE);
    });

    test('options.asset overrides the default for this voice only', () => {
      const a = fakeAsset();
      const b = fakeAsset('alt', 'alt.ogg');
      const { source } = setup(a);

      const voice = source.play({ asset: b });
      expect(voice.buffer).toBe(b.raw);
      expect(source.asset).toBe(a);
    });

    test('setAsset updates the default for future plays', () => {
      const a = fakeAsset();
      const b = fakeAsset('alt', 'alt.ogg');
      const { source } = setup(a);

      source.setAsset(b);
      const voice = source.play();
      expect(voice.buffer).toBe(b.raw);
    });

    test('volume/pan setters re-target active voices', () => {
      const { source } = setup();

      const voice = source.play();
      source.volume = 0.25;
      source.pan = 0.4;
      expect(voice.volume).toBeCloseTo(0.25);
      expect(voice.pan).toBeCloseTo(0.4);
    });

    test('constructor options apply to the source defaults', () => {
      const world = new World(Game.createHeadless(), {
        components: () => ({}),
      });
      const obj = world.createEmpty();
      const source = new AudioSource(obj, fakeAsset(), {
        volume: 0.2,
        pan: -0.5,
      });
      expect(source.volume).toBeCloseTo(0.2);
      expect(source.pan).toBeCloseTo(-0.5);
    });

    test('stop tears down every active voice', () => {
      const { source } = setup();

      source.play();
      source.play();
      source.play();
      expect(source.activeVoiceCount).toBe(3);
      source.stop();
      expect(source.activeVoiceCount).toBe(0);
    });

    test('onDestroy stops every active voice', () => {
      const { world, obj, source } = setup();

      source.play();
      obj.destroy();
      world.update();
      expect(source.activeVoiceCount).toBe(0);
    });
  });

  describe('with a faked AudioContext', () => {
    let ctx: StubAudioContext;
    let uninstall: () => void;

    beforeEach(() => {
      const installed = installFakeAudioContext();
      ctx = installed.context;
      uninstall = installed.uninstall;
    });

    afterEach(() => {
      uninstall();
    });

    test('prunes a voice from its tracked set when it ends naturally', () => {
      const { source } = setup();

      source.play();
      expect(source.activeVoiceCount).toBe(1);
      const last = ctx._sourceNodes[ctx._sourceNodes.length - 1];
      last?.triggerEnded();
      expect(source.activeVoiceCount).toBe(0);
    });
  });
});
