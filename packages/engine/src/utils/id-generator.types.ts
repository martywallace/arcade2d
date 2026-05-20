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
