import { clampVolume } from './audio.support';

describe('clampVolume', () => {
  test('passes through values already within 0 to 1', () => {
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(1)).toBe(1);
  });

  test('clamps values above 1 down to 1', () => {
    expect(clampVolume(5)).toBe(1);
    expect(clampVolume(Infinity)).toBe(1);
  });

  test('clamps negative values up to 0', () => {
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(-Infinity)).toBe(0);
  });

  test('collapses NaN to 0 rather than letting it reach the audio graph', () => {
    expect(clampVolume(NaN)).toBe(0);
  });
});
