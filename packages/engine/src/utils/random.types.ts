/**
 * Options accepted by the {@link Random} constructor.
 */
export type RandomOptions = {
  /**
   * The seed for the underlying PRNG. A `number` is masked into a 32-bit
   * integer; a `string` is hashed deterministically into a 32-bit integer, so
   * named seeds like `'level-3'` work as expected. Omit (or pass `undefined`)
   * for a time-based seed.
   */
  readonly seed?: number | string;

  /**
   * The exact internal state to restore. Pair with the value returned by
   * {@link Random.getState} to resume a generator at the same point it left
   * off. When supplied, `state` overrides `seed`.
   */
  readonly state?: number;
};
