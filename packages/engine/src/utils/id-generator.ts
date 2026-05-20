/**
 * Options accepted by the {@link IDGenerator} constructor. Also the shape
 * returned by {@link IDGenerator.getState}, so a generator can be persisted
 * and later rehydrated by passing the captured object straight back into a
 * new instance.
 */
export type IDGeneratorOptions = {
  /**
   * An optional prefix prepended to every issued id, separated by `@`. When
   * omitted, ids are the bare base36 counter.
   */
  readonly prefix?: string;

  /**
   * The counter value to start from. The next call to
   * {@link IDGenerator.next} will produce the id derived from `lastId + 1`.
   * Defaults to `0`, so a fresh generator first hands out the id for `1`.
   *
   * Values that are not non-negative integers are coerced to `0`.
   */
  readonly lastId?: number;
};

/**
 * Mints short, monotonically increasing string identifiers. Used by the engine
 * to assign ids to objects that need a stable handle for the lifetime of a
 * world (e.g. {@link World} entities and {@link Prefab} instances).
 *
 * Ids are produced by base36-encoding an internal counter that increments on
 * every call to {@link IDGenerator.next}. If a `prefix` is supplied, it is
 * joined to the encoded counter with an `@` separator (e.g. `Player@3`),
 * making ids easier to grep for and recognise in logs.
 *
 * The generator is **not** intended to be cryptographically random, globally
 * unique across processes, or stable across re-runs of a fresh generator —
 * two `IDGenerator` instances created with the same prefix will hand out the
 * same ids. Pair distinct prefixes with distinct generators when you need
 * separation, or restore a previously persisted generator by passing
 * {@link IDGenerator.getState} output back into the constructor.
 *
 * @example
 * ```typescript
 * const ids = new IDGenerator({ prefix: 'Player' });
 * ids.next(); // 'Player@1'
 * ids.peek(); // 'Player@2' (does not advance)
 * ids.next(); // 'Player@2'
 * ids.count; // 2
 *
 * // Round-trip through persisted state:
 * const resumed = new IDGenerator(ids.getState());
 * resumed.next(); // 'Player@3'
 * ```
 */
export class IDGenerator {
  /**
   * The prefix this generator was constructed with, or `undefined` if it was
   * created without one.
   */
  public readonly prefix?: string;

  private _lastId: number;

  /**
   * Creates a new generator. With no arguments, ids start at `1` and have no
   * prefix.
   *
   * @param options Prefix and/or initial counter to seed from. The shape is
   * intentionally identical to {@link IDGenerator.getState}, so a captured
   * state can be passed straight back in to resume id minting.
   */
  constructor(options: IDGeneratorOptions = {}) {
    this.prefix = options.prefix;
    this._lastId =
      options.lastId !== undefined &&
      Number.isInteger(options.lastId) &&
      options.lastId >= 0
        ? options.lastId
        : 0;
  }

  /**
   * Advances the counter and returns the next id.
   *
   * @returns A new id, unique within the lifetime of this generator.
   */
  public next(): string {
    return this._format(++this._lastId);
  }

  /**
   * Returns the id that the *next* call to {@link IDGenerator.next} will
   * produce, without advancing the counter. Useful in tests, and when an id
   * needs to be referenced (logged, stored, displayed) before the object that
   * will own it has finished being constructed.
   *
   * Calling `peek` repeatedly returns the same value until `next` is called.
   */
  public peek(): string {
    return this._format(this._lastId + 1);
  }

  /**
   * Captures the current state of this generator. Pass the result to a new
   * `IDGenerator` to recreate a generator that resumes issuing ids from the
   * same point — handy when persisting world state.
   */
  public getState(): IDGeneratorOptions {
    return { prefix: this.prefix, lastId: this._lastId };
  }

  /**
   * The number of ids this generator has issued so far. Equivalent to the
   * counter value behind the most recently returned id, and `0` for a fresh
   * generator that has never had {@link IDGenerator.next} called on it.
   */
  public get count(): number {
    return this._lastId;
  }

  private _format(value: number): string {
    const encoded = value.toString(36);

    return this.prefix ? this.prefix + '@' + encoded : encoded;
  }
}
