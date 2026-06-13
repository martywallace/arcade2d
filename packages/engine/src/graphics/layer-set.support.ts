import { LayerSet } from './layer-set';

/**
 * Declares an ordered set of render layers — the recommended way to give a game
 * a developer-defined draw order with compile-time-safe layer references.
 *
 * Pass the layer names back-to-front: the first name is drawn furthest back,
 * the last on top. The `const` type parameter captures the names as their exact
 * literal union, so {@link LayerSet.get} rejects an unknown layer name at
 * compile time rather than throwing {@link ErrorCode.LAYER_NOT_IN_SET} only when
 * the mis-named graphic spawns. The `[string, ...string[]]` tuple makes a
 * zero-argument call a compile error — a set must declare at least one layer.
 *
 * Hand the result to {@link Game.createWorld} as `layers`, and pass the tokens
 * it returns to graphics components via {@link GraphicsOptions.layer}.
 *
 * @param names The layer names, back-to-front. At least one; duplicate-free.
 * @returns A {@link LayerSet} carrying the literal name types.
 * @throws {@link EngineError} with code {@link ErrorCode.LAYER_DUPLICATE_NAME}
 * when a name repeats.
 *
 * @example
 * ```ts
 * // ground (back) < structures < characters < ui (front)
 * export const layers = defineLayers('ground', 'structures', 'characters', 'ui');
 *
 * const world = game.createWorld({ layers });
 *
 * new Sprite(player, texture, { layer: layers.get('characters') });
 * ```
 *
 * @see {@link LayerSet} for the returned collection.
 * @see {@link Layer} for an individual layer token.
 */
export function defineLayers<const T extends readonly [string, ...string[]]>(
  ...names: T
): LayerSet<T> {
  return new LayerSet(names);
}
