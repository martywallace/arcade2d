import { Game } from '../game';
import { World } from '../world/world';
import { AudioAsset } from './audio-asset';
import { Music } from './music';

function fakeAsset(): AudioAsset {
  const buffer = {
    duration: 60,
    numberOfChannels: 2,
    sampleRate: 44_100,
  } as unknown as AudioBuffer;
  return new AudioAsset('theme', 'default', 'theme.ogg', buffer);
}

function createMusic(options: ConstructorParameters<typeof Music>[2] = {}): {
  world: World;
  music: Music;
} {
  const world = new World(Game.createHeadless(), { components: () => ({}) });
  const music = new Music(world, fakeAsset(), options);
  world.addComponent('music', music);
  return { world, music };
}

describe('Music', () => {
  test('does not autoplay by default', () => {
    const { music } = createMusic();
    expect(music.playing).toBe(false);
    expect(music.stopped).toBe(true);
  });

  test('autoplay: true starts playback immediately', () => {
    const { music } = createMusic({ autoplay: true });
    expect(music.playing).toBe(true);
  });

  test('loops by default', () => {
    const { music } = createMusic();
    expect(music.loop).toBe(true);
  });

  test('honours initial volume, pan, and loop options', () => {
    const { music } = createMusic({ volume: 0.4, pan: 0.2, loop: false });
    expect(music.volume).toBeCloseTo(0.4);
    expect(music.pan).toBeCloseTo(0.2);
    expect(music.loop).toBe(false);
  });

  test('play / pause / stop / restart cycle the underlying instance state', () => {
    const { music } = createMusic();
    music.play();
    expect(music.playing).toBe(true);

    music.pause();
    expect(music.paused).toBe(true);
    expect(music.playing).toBe(false);

    music.play();
    expect(music.playing).toBe(true);

    music.stop();
    expect(music.stopped).toBe(true);

    music.restart();
    expect(music.playing).toBe(true);
  });

  test('volume / pan / loop setters mutate the underlying instance', () => {
    const { music } = createMusic();
    music.volume = 0.1;
    music.pan = -0.8;
    music.loop = false;
    expect(music.instance.volume).toBeCloseTo(0.1);
    expect(music.instance.pan).toBeCloseTo(-0.8);
    expect(music.instance.loop).toBe(false);
  });

  test('duration mirrors the underlying clip', () => {
    const { music } = createMusic();
    expect(music.duration).toBe(60);
  });

  test('onDestroy tears the instance down', () => {
    const { world, music } = createMusic({ autoplay: true });
    expect(music.playing).toBe(true);
    world.destroy();
    expect(music.stopped).toBe(true);
  });
});
