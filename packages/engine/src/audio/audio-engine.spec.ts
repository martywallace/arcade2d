import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Game } from '../game';
import { AudioEngine } from './audio-engine';
import { AudioCategory } from './audio.constants';
import { AudioInstance } from './audio-instance';
import {
  installFakeAudioContext,
  StubAudioContext,
} from './fake-audio-context';

function captureError(thunk: () => unknown): EngineError | null {
  try {
    thunk();
  } catch (error) {
    return error as EngineError;
  }
  return null;
}

async function captureAsyncError(
  promise: Promise<unknown>,
): Promise<EngineError | null> {
  try {
    await promise;
  } catch (error) {
    return error as EngineError;
  }
  return null;
}

describe('AudioEngine', () => {
  describe('headless mode', () => {
    test('is created in headless mode when no AudioContext is available', () => {
      const engine = Game.createHeadless().audio;
      expect(engine).toBeInstanceOf(AudioEngine);
      expect(engine.available).toBe(false);
      expect(engine.raw).toBeNull();
    });

    test('master/music/sfx volume getters return 0 in headless mode', () => {
      const engine = Game.createHeadless().audio;
      expect(engine.masterVolume).toBe(0);
      expect(engine.musicVolume).toBe(0);
      expect(engine.sfxVolume).toBe(0);
    });

    test('volume setters are silent no-ops in headless mode', () => {
      const engine = Game.createHeadless().audio;
      engine.masterVolume = 0.5;
      engine.musicVolume = 0.4;
      engine.sfxVolume = 0.3;
      expect(engine.masterVolume).toBe(0);
    });

    test('decodeAudioData throws AUDIO_UNAVAILABLE in headless mode', async () => {
      const engine = Game.createHeadless().audio;
      const error = await captureAsyncError(
        engine.decodeAudioData(new ArrayBuffer(8)),
      );
      expect(error?.code).toBe(ErrorCode.AUDIO_UNAVAILABLE);
    });

    test('loadAudioBuffer throws AUDIO_UNAVAILABLE in headless mode', async () => {
      const engine = Game.createHeadless().audio;
      const error = await captureAsyncError(engine.loadAudioBuffer('foo.ogg'));
      expect(error?.code).toBe(ErrorCode.AUDIO_UNAVAILABLE);
    });

    test('resume / suspend are no-ops in headless mode', async () => {
      const engine = Game.createHeadless().audio;
      await expect(engine.resume()).resolves.toBeUndefined();
      await expect(engine.suspend()).resolves.toBeUndefined();
    });

    test('createInstance returns an inert instance in headless mode', () => {
      const engine = Game.createHeadless().audio;
      const fakeBuffer = { duration: 1 } as AudioBuffer;
      const inst = engine.createInstance(fakeBuffer, AudioCategory.Sfx);
      expect(inst).toBeInstanceOf(AudioInstance);
      inst.play();
      // Headless instance state still tracks transitions, but no source is
      // allocated — `playing` flips through normal logic.
      expect(inst.playing).toBe(true);
    });

    test('disabled: true forces headless even when AudioContext is present', () => {
      const { uninstall } = installFakeAudioContext();
      try {
        const game = Game.createHeadless({ audio: { disabled: true } });
        expect(game.audio.available).toBe(false);
      } finally {
        uninstall();
      }
    });
  });

  describe('with a real (faked) AudioContext', () => {
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

    test('available is true and raw points at the underlying context', () => {
      const engine = Game.createHeadless().audio;
      expect(engine.available).toBe(true);
      expect(engine.raw).toBe(ctx);
    });

    test('builds master/music/sfx gain chain wired to destination', () => {
      Game.createHeadless();
      expect(ctx._gainNodes.length).toBe(3);
      const [master, music, sfx] = ctx._gainNodes;
      expect(master?._connections).toContain(ctx.destination);
      expect(music?._connections).toContain(master);
      expect(sfx?._connections).toContain(master);
    });

    test('honours initial volumes from options', () => {
      const game = Game.createHeadless({
        audio: { masterVolume: 0.2, musicVolume: 0.3, sfxVolume: 0.4 },
      });
      expect(game.audio.masterVolume).toBeCloseTo(0.2);
      expect(game.audio.musicVolume).toBeCloseTo(0.3);
      expect(game.audio.sfxVolume).toBeCloseTo(0.4);
    });

    test('setting volumes ramps the corresponding gain node', () => {
      const engine = Game.createHeadless().audio;
      engine.masterVolume = 0.5;
      engine.musicVolume = 0.6;
      engine.sfxVolume = 0.7;
      expect(engine.masterVolume).toBeCloseTo(0.5);
      expect(engine.musicVolume).toBeCloseTo(0.6);
      expect(engine.sfxVolume).toBeCloseTo(0.7);
    });

    test('decodeAudioData delegates to the underlying context', async () => {
      const engine = Game.createHeadless().audio;
      const buf = await engine.decodeAudioData(new ArrayBuffer(16));
      expect(buf.duration).toBe(1);
    });

    test('loadAudioBuffer fetches and decodes', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(32)),
      } as unknown as Response);
      try {
        const engine = Game.createHeadless().audio;
        const buf = await engine.loadAudioBuffer('http://x/clip.ogg');
        expect(fetchSpy).toHaveBeenCalledWith('http://x/clip.ogg');
        expect(buf.duration).toBe(1);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    test('loadAudioBuffer throws on a non-OK fetch response', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as unknown as Response);
      try {
        const engine = Game.createHeadless().audio;
        await expect(engine.loadAudioBuffer('missing.ogg')).rejects.toThrow(
          /404/,
        );
      } finally {
        fetchSpy.mockRestore();
      }
    });

    test('createInstance routes through the requested category bus', () => {
      const engine = Game.createHeadless().audio;
      const buf = { duration: 1 } as AudioBuffer;
      const music = engine.createInstance(buf, AudioCategory.Music);
      const sfx = engine.createInstance(buf, AudioCategory.Sfx);
      expect(music).toBeInstanceOf(AudioInstance);
      expect(sfx).toBeInstanceOf(AudioInstance);
      // Each new instance creates one gain + one panner.
      expect(ctx._gainNodes.length).toBe(3 + 2);
      expect(ctx._pannerNodes.length).toBe(2);
    });

    test('resume on a suspended context awaits the underlying resume', async () => {
      const engine = Game.createHeadless().audio;
      await engine.suspend();
      expect(ctx.state).toBe('suspended');
      await engine.resume();
      expect(ctx.state).toBe('running');
    });

    test('onDestroy closes the underlying context', () => {
      const engine = Game.createHeadless().audio;
      engine.onDestroy();
      expect(ctx.closed).toBe(true);
    });

    test('captureError is unused outside this block', () => {
      // Sanity: helper is defined for the sync error path used in
      // sibling specs (audio-source, music).
      expect(captureError(() => undefined)).toBeNull();
    });
  });
});
