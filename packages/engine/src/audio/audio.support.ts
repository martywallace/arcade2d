/**
 * Clamps a volume scalar into the `0`–`1` range the audio API documents.
 *
 * Web Audio `GainNode.gain` accepts any finite number — values above `1`
 * amplify (clipping/distortion) and negative values invert phase — so the
 * documented `0`–`1` contract is only real if it is enforced. Every volume
 * setter (master, category buses, per-instance, per-source) routes through
 * this so the stored value and the underlying gain agree on the clamped
 * result. `NaN` collapses to `0` rather than propagating into the graph.
 *
 * @param value The requested volume.
 * @returns `value` clamped to `[0, 1]`, or `0` when `value` is `NaN`.
 */
export function clampVolume(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}
