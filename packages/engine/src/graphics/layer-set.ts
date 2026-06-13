import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import { Layer } from './layer';

/**
 * An ordered, named set of render layers — the developer-defined draw order a
 * game stamps onto its graphics.
 *
 * The engine ships **no** built-in layers. A game declares its own bands once,
 * back-to-front, with {@link defineLayers}, and passes the resulting
 * {@link Layer} tokens to its graphics components via
 * {@link GraphicsOptions.layer}. A {@link Scene} created with the set renders
 * each band in order, and within a band keeps insertion (spawn) order — so the
 * cross-band order is stable no matter when objects spawn, while same-band
 * order still falls out of creation order as before.
 *
 * ## Type-safe lookup
 *
 * Like {@link AssetBundle}, a `LayerSet` is *just data* with compile-checked
 * keys. Because {@link defineLayers} captures the names as their literal types,
 * {@link LayerSet.get} only accepts a name the set actually declares — a typo is
 * a `tsc` error, not a runtime {@link ErrorCode.LAYER_NOT_IN_SET} that fires
 * only when the mis-named graphic first spawns.
 *
 * Construct via {@link defineLayers}, not `new` — the factory captures the
 * literal name union the constructor's generic alone cannot.
 *
 * @template T The tuple of layer names, carrying the literal name union.
 *
 * @example
 * ```ts
 * export const layers = defineLayers('ground', 'structures', 'characters', 'ui');
 *
 * const world = game.createWorld({ layers });
 *
 * // ground (back) < structures < characters < ui (front)
 * new Sprite(object, texture, { layer: layers.get('characters') });
 * layers.get('charcters'); // tsc error: not assignable to the name union
 * ```
 *
 * @see {@link defineLayers} for the factory.
 * @see {@link Layer} for an individual layer token.
 * @see {@link Scene} for the component that maps a set onto draw order.
 */
export class LayerSet<T extends readonly string[] = readonly string[]> {
  // A unique brand per set, stamped onto every Layer it mints. Lets a Scene
  // tell its own tokens apart from a different set's structurally-identical
  // ones at runtime.
  private readonly _id = Symbol('arcade2d.layerSet');
  private readonly _ordered: readonly Layer[];
  private readonly _byName: ReadonlyMap<string, Layer>;

  /**
   * @param names The layer names, back-to-front. Must be non-empty and
   * duplicate-free.
   * @throws {@link EngineError} with code {@link ErrorCode.LAYER_SET_EMPTY}
   * when `names` is empty.
   * @throws {@link EngineError} with code {@link ErrorCode.LAYER_DUPLICATE_NAME}
   * when a name repeats.
   *
   * @internal Prefer {@link defineLayers}, which also captures the literal name
   * types `get` checks against.
   */
  constructor(names: T) {
    if (names.length === 0) {
      throwEngineError(
        ErrorCode.LAYER_SET_EMPTY,
        'defineLayers was called with no layer names — a layer set must ' +
          'declare at least one layer.',
        {},
      );
    }

    const byName = new Map<string, Layer>();
    const ordered: Layer[] = [];

    names.forEach((name, order) => {
      if (byName.has(name)) {
        throwEngineError(
          ErrorCode.LAYER_DUPLICATE_NAME,
          `defineLayers was given the layer name "${name}" more than once; ` +
            'layer names must be unique within a set.',
          { name },
        );
      }

      const layer = new Layer(name, order, this._id);
      byName.set(name, layer);
      ordered.push(layer);
    });

    this._ordered = ordered;
    this._byName = byName;
  }

  /**
   * Resolves a layer name to its {@link Layer} token. The argument is checked
   * against the set's declared names at compile time.
   *
   * @param name A declared layer name.
   * @returns The matching {@link Layer}.
   * @throws {@link EngineError} with code {@link ErrorCode.LAYER_NOT_IN_SET}
   * when the name isn't in the set. With a statically-typed set this is
   * unreachable from well-typed code; it guards dynamic callers.
   */
  public get(name: T[number]): Layer {
    const layer = this._byName.get(name);

    if (!layer) {
      throwEngineError(
        ErrorCode.LAYER_NOT_IN_SET,
        `No layer named "${name}" in this set. Declared layers: ` +
          `${this.names.join(', ')}.`,
        { name },
      );
    }

    return layer;
  }

  /**
   * Whether the set declares a layer with the given name.
   *
   * @param name The name to test.
   */
  public has(name: string): boolean {
    return this._byName.has(name);
  }

  /**
   * The declared layer names, in back-to-front order.
   */
  public get names(): readonly string[] {
    return this._ordered.map((layer) => layer.name);
  }

  /**
   * The {@link Layer} tokens, in back-to-front order. The {@link Scene} reads
   * this to build one render container per layer.
   */
  public get layers(): readonly Layer[] {
    return this._ordered;
  }

  /**
   * Whether `layer` was minted by this set. Used by {@link Scene} to reject a
   * token from a different {@link LayerSet}.
   *
   * @param layer The token to test.
   */
  public owns(layer: Layer): boolean {
    return layer.setId === this._id;
  }
}
