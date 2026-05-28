import { AssetType } from '../assets/asset.constants';
import { AudioAsset } from './audio-asset';

function fakeBuffer(
  opts: {
    duration?: number;
    channels?: number;
    sampleRate?: number;
  } = {},
): AudioBuffer {
  return {
    duration: opts.duration ?? 1.5,
    numberOfChannels: opts.channels ?? 2,
    sampleRate: opts.sampleRate ?? 44_100,
  } as unknown as AudioBuffer;
}

describe('AudioAsset', () => {
  test('reports the Audio asset type', () => {
    const asset = new AudioAsset('theme', 'level-1', 'theme.ogg', fakeBuffer());

    expect(asset.type).toBe(AssetType.Audio);
  });

  test('retains its identity fields', () => {
    const asset = new AudioAsset(
      'theme',
      'level-1',
      'music/theme.ogg',
      fakeBuffer(),
    );

    expect(asset.key).toBe('theme');
    expect(asset.namespace).toBe('level-1');
    expect(asset.src).toBe('music/theme.ogg');
  });

  test('exposes the wrapped buffer via raw', () => {
    const buffer = fakeBuffer();
    const asset = new AudioAsset('theme', 'default', 'theme.ogg', buffer);

    expect(asset.raw).toBe(buffer);
  });

  test('surfaces duration, channels, and sample rate', () => {
    const asset = new AudioAsset(
      'theme',
      'default',
      'theme.ogg',
      fakeBuffer({ duration: 12.5, channels: 1, sampleRate: 48_000 }),
    );

    expect(asset.duration).toBe(12.5);
    expect(asset.channelCount).toBe(1);
    expect(asset.sampleRate).toBe(48_000);
  });
});
