/**
 * One render layer in a {@link LayerSet} — a lightweight, world-agnostic token
 * that names a band in the draw order and remembers where it sits in that
 * order.
 *
 * A `Layer` carries no rendering state of its own. It is an *identity*: a game
 * defines its layers once via {@link defineLayers}, then passes the resulting
 * tokens to graphics components ({@link GraphicsOptions.layer}). Each
 * {@link Scene} maps these tokens onto its own Pixi sub-containers, so the same
 * `Layer` can describe the draw order of any number of worlds without holding a
 * reference to any of them.
 *
 * The {@link Layer.setId} brand records which {@link LayerSet} minted the token,
 * so a `Scene` can reject a token that belongs to a different set
 * ({@link ErrorCode.LAYER_NOT_IN_SET}) rather than silently mis-layering a
 * graphic.
 *
 * Construct layers with {@link defineLayers}, never `new Layer` — the factory is
 * the only supported way to mint a set and its tokens together.
 *
 * @see {@link LayerSet} for the ordered collection a layer belongs to.
 * @see {@link defineLayers} for the factory that creates both.
 */
export class Layer {
  /**
   * @param name The layer's name — the key {@link LayerSet.get} looks it up by.
   * @param order Its position in the set's back-to-front order; `0` is drawn
   * first (furthest back).
   * @param setId The identity of the owning {@link LayerSet}, used to reject
   * tokens from a foreign set. Not meaningful to game code.
   *
   * @internal Layers are minted by {@link LayerSet}; do not call directly.
   */
  constructor(
    public readonly name: string,
    public readonly order: number,
    public readonly setId: symbol,
  ) {}
}
