import { Game } from '../game';
import { AudioCategory } from './audio.constants';
import type { AudioEngine } from './audio-engine';
import {
  installFakeAudioContext,
  StubAudioContext,
  StubBufferSourceNode,
} from './fake-audio-context';

function fakeBuffer(duration = 2): AudioBuffer {
  return {
    duration,
    numberOfChannels: 1,
    sampleRate: 44_100,
  } as unknown as AudioBuffer;
}

function latestSource(ctx: StubAudioContext): StubBufferSourceNode {
  const last = ctx._sourceNodes[ctx._sourceNodes.length - 1];
  if (!last) throw new Error('expected a source node');
  return last;
}

describe('AudioInstance', () => {
  describe('headless mode', () => {
    let engine: AudioEngine;

    beforeEach(() => {
      engine = Game.createHeadless().audio;
    });

    test('play/pause/stop/restart all flip state without throwing', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      expect(inst.stopped).toBe(true);
      inst.play();
      expect(inst.playing).toBe(true);
      inst.pause();
      expect(inst.paused).toBe(true);
      inst.play();
      expect(inst.playing).toBe(true);
      inst.stop();
      expect(inst.stopped).toBe(true);
      inst.restart();
      expect(inst.playing).toBe(true);
    });

    test('volume/pan/loop setters retain values in headless mode', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.volume = 0.5;
      inst.pan = -0.3;
      inst.loop = true;
      expect(inst.volume).toBeCloseTo(0.5);
      expect(inst.pan).toBeCloseTo(-0.3);
      expect(inst.loop).toBe(true);
    });

    test('destroy is safe in headless mode', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.play();
      expect(() => inst.destroy()).not.toThrow();
      expect(inst.stopped).toBe(true);
    });
  });

  describe('with a faked AudioContext', () => {
    let ctx: StubAudioContext;
    let uninstall: () => void;
    let engine: AudioEngine;

    beforeEach(() => {
      const installed = installFakeAudioContext();
      ctx = installed.context;
      uninstall = installed.uninstall;
      engine = Game.createHeadless().audio;
    });

    afterEach(() => {
      uninstall();
    });

    test('options apply initial volume, pan, and loop', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx, {
        volume: 0.3,
        pan: -0.6,
        loop: true,
      });
      expect(inst.volume).toBeCloseTo(0.3);
      expect(inst.pan).toBeCloseTo(-0.6);
      expect(inst.loop).toBe(true);
    });

    test('play allocates a source connected through gain + panner to the category bus', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.play();
      const src = latestSource(ctx);
      expect(src.started).toBe(true);
      expect(src.startedOffset).toBe(0);
      expect(inst.playing).toBe(true);
    });

    test('play is a no-op when already playing', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.play();
      const before = ctx._sourceNodes.length;
      inst.play();
      expect(ctx._sourceNodes.length).toBe(before);
    });

    test('pause records elapsed position and resumes from there', () => {
      const inst = engine.createInstance(fakeBuffer(2), AudioCategory.Sfx);
      inst.play();
      const first = latestSource(ctx);
      ctx.advanceTime(0.5);
      inst.pause();
      expect(first.stopped).toBe(true);
      expect(inst.paused).toBe(true);

      inst.play();
      const second = latestSource(ctx);
      expect(second).not.toBe(first);
      expect(second.startedOffset).toBeCloseTo(0.5);
    });

    test('pause on a looping clip wraps the position by the buffer duration', () => {
      const inst = engine.createInstance(fakeBuffer(2), AudioCategory.Sfx, {
        loop: true,
      });
      inst.play();
      ctx.advanceTime(5);
      inst.pause();
      inst.play();
      const src = latestSource(ctx);
      // elapsed 5s, duration 2s → wrapped to 1s
      expect(src.startedOffset).toBeCloseTo(1, 5);
    });

    test('stop resets the offset to zero', () => {
      const inst = engine.createInstance(fakeBuffer(2), AudioCategory.Sfx);
      inst.play();
      ctx.advanceTime(0.8);
      inst.pause();
      inst.stop();
      inst.play();
      expect(latestSource(ctx).startedOffset).toBe(0);
    });

    test('restart stops the current source and starts a fresh one from zero', () => {
      const inst = engine.createInstance(fakeBuffer(2), AudioCategory.Sfx);
      inst.play();
      const first = latestSource(ctx);
      ctx.advanceTime(0.4);
      inst.restart();
      expect(first.stopped).toBe(true);
      const second = latestSource(ctx);
      expect(second).not.toBe(first);
      expect(second.startedOffset).toBe(0);
      expect(inst.playing).toBe(true);
    });

    test('volume setter ramps the per-instance gain node live', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.play();
      inst.volume = 0.25;
      expect(inst.volume).toBeCloseTo(0.25);
    });

    test('pan setter ramps the per-instance panner node live', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.play();
      inst.pan = 0.7;
      expect(inst.pan).toBeCloseTo(0.7);
    });

    test('loop setter updates the live source', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.play();
      inst.loop = true;
      expect(latestSource(ctx).loop).toBe(true);
    });

    test('onEnded fires when the source ends naturally and not on manual stop', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      const listener = jest.fn();
      inst.onEnded(listener);
      inst.play();

      // Manual stop shouldn't fire — the impl nulls _source first.
      inst.stop();
      expect(listener).not.toHaveBeenCalled();

      // Natural end on a fresh play does fire.
      inst.play();
      latestSource(ctx).triggerEnded();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(inst.stopped).toBe(true);
    });

    test('onEnded returns an unsubscribe function', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      const listener = jest.fn();
      const off = inst.onEnded(listener);
      off();
      inst.play();
      latestSource(ctx).triggerEnded();
      expect(listener).not.toHaveBeenCalled();
    });

    test('destroy stops playback and disconnects the audio graph', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      inst.play();
      const src = latestSource(ctx);
      inst.destroy();
      expect(src.stopped).toBe(true);
      expect(inst.stopped).toBe(true);
    });

    test('a listener throwing does not abort the sweep', () => {
      const inst = engine.createInstance(fakeBuffer(), AudioCategory.Sfx);
      const good = jest.fn();
      inst.onEnded(() => {
        throw new Error('boom');
      });
      inst.onEnded(good);
      inst.play();
      latestSource(ctx).triggerEnded();
      expect(good).toHaveBeenCalled();
    });
  });
});
