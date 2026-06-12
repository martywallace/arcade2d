import { Polygon } from '@arcade2d/engine';

/** Shared palette for the demo's health bars (enemy floating bars and the HUD). */
export const BAR_COLOUR_BACKDROP = 0x20202a;
const COLOUR_FULL = 0x4caf50; // green at full health
const COLOUR_EMPTY = 0xe23b3b; // red at empty

/**
 * A rectangle {@link Polygon} whose local origin is its left-middle edge, so
 * scaling the host's x drains the fill toward the left rather than the centre.
 *
 * @param width Rectangle width in world units.
 * @param height Rectangle height in world units.
 */
export function leftAnchoredRect(width: number, height: number): Polygon {
  const half = height / 2;

  return new Polygon([
    { x: 0, y: -half },
    { x: width, y: -half },
    { x: width, y: half },
    { x: 0, y: half },
  ]);
}

/**
 * The fill colour for a health bar at the given fraction — green at full,
 * lerping to red as it empties.
 *
 * @param ratio Remaining health as a `0`–`1` fraction.
 */
export function healthFillColour(ratio: number): number {
  return lerpColour(COLOUR_EMPTY, COLOUR_FULL, ratio);
}

/** Linearly interpolates two 24-bit RGB colours; `t` clamps to `[0, 1]`. */
function lerpColour(from: number, to: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const lerp = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;

    return Math.round(a + (b - a) * k) & 0xff;
  };

  return (lerp(16) << 16) | (lerp(8) << 8) | lerp(0);
}
