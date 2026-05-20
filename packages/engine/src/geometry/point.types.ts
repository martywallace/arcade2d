/**
 * Plain structural shape used for any `{ x, y }` value the engine accepts —
 * including the {@link Point} class itself and bare object literals like
 * `{ x: 100, y: 200 }`. Methods that consume coordinates accept this rather
 * than `Point` so callers don't have to allocate when a literal is enough.
 */
export interface PointPrimitive {
  /**
   * The horizontal value of the point.
   */
  x: number;

  /**
   * The vertical value of the point.
   */
  y: number;
}

/**
 * Frozen variant of {@link PointPrimitive} — both the `readonly` modifier
 * and a runtime `Object.freeze` are applied by the producers that return
 * this type. Use when handing a primitive snapshot to user code that must
 * not write back.
 */
export type ImmutablePointPrimitive = Readonly<PointPrimitive>;
