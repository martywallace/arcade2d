/**
 * Shared base class for the tier-specific abstract component classes —
 * {@link AbstractGameComponent}, {@link AbstractWorldComponent}, and
 * {@link AbstractWorldObjectComponent}.
 *
 * Holds the two pieces of state that every component has regardless of which
 * tier it lives at: the {@link AbstractComponent.host} reference (taken
 * positionally by the constructor and exposed read-only) and the
 * {@link AbstractComponent.enabled} flag (defaulted to `true`, mutable for
 * pause/freeze use cases).
 *
 * **You almost never want this class directly.** It does not implement any
 * lifecycle hooks — the per-tier subclasses do, with the correct host type,
 * the correct dependency-resolver signature on `resolveDependencies`, and
 * the tier-appropriate convenience accessors (`this.world`, `this.game`).
 * Reach for {@link AbstractGameComponent},
 * {@link AbstractWorldComponent}, or
 * {@link AbstractWorldObjectComponent} instead. This base is exported only
 * so user code building its own further-specialised abstract bases has
 * something to extend.
 *
 * @template THost The host type the component is attached to.
 */
export abstract class AbstractComponent<THost> {
  /**
   * Per-component gate on the three update hooks (`onPreUpdate`,
   * `onUpdate`, `onPostUpdate`). When explicitly `false`, the engine skips
   * all three for this component during the host's tick — useful for
   * temporarily pausing behaviour (e.g. a freeze powerup) without removing
   * the component and losing its internal state.
   *
   * Does not gate `onAdded` or `onDestroy`; those always fire so a host can
   * never end up with a half-attached component.
   */
  public enabled = true;

  /**
   * @param host The host this component is attached to. Stored read-only;
   * subclasses access it as `this.host` directly, or through the
   * tier-appropriate aliases (`this.world`, `this.game`) on the per-tier
   * abstract bases.
   */
  constructor(public readonly host: THost) {}
}
