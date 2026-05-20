import { AbstractComponent } from '../abstract-component';
import type { Game } from '../game';
import type { WorldComponent } from './dependencies.types';
import type { World } from './world';
import type { WorldUpdate } from './world-update';

/**
 * Abstract base class for components attached to a {@link World}.
 *
 * The recommended way to implement the {@link WorldComponent} contract.
 * Supplies the boilerplate every world-scoped system would otherwise
 * write by hand:
 *
 * - The {@link AbstractComponent.host} reference, typed as {@link World}.
 * - A {@link AbstractWorldComponent.world} alias (identical to `host`
 *   at this tier) so subclass code reads symmetrically with the
 *   {@link AbstractWorldObjectComponent} convenience.
 * - A {@link AbstractWorldComponent.game} accessor that hops through
 *   the world to the parent {@link Game} — the single-step way to reach
 *   page-scoped services like the keyboard or mouse samplers.
 * - No-op default implementations of the required lifecycle hooks
 *   (`onAdded`, `onUpdate`, `onDestroy`) so subclasses only override
 *   the ones they actually use. The optional `onPreUpdate` and
 *   `onPostUpdate` hooks remain opt-in — declare them only when
 *   needed.
 *
 * Subclasses that take additional constructor arguments must define
 * their own constructor and forward `host` via `super(host)`. Subclasses
 * that need nothing beyond the host can omit the constructor entirely
 * and inherit the one on this base.
 *
 * @template TDeps The shape of the resolved dependencies threaded into
 * every lifecycle hook. Defaults to an empty object for components with
 * no dependencies — they can omit the `deps` parameter at each hook
 * entirely.
 *
 * @example
 * ```typescript
 * class PauseGate extends AbstractWorldComponent {
 *   public onUpdate(): void {
 *     if (this.game.getKeyboardState().isDown('Escape')) {
 *       this.world.enabled = false;
 *     }
 *   }
 * }
 * ```
 */
export abstract class AbstractWorldComponent<TDeps = Record<string, never>>
  extends AbstractComponent<World>
  implements WorldComponent<TDeps>
{
  /**
   * The {@link World} this component is attached to — identical to
   * {@link AbstractComponent.host} at this tier, exposed under the
   * `world` name so subclass code reads the same on every tier.
   */
  public get world(): World {
    return this.host;
  }

  /**
   * The {@link Game} the host world belongs to. Always non-null — the
   * world's `game` field is a mandatory construction argument, not an
   * option.
   */
  public get game(): Game {
    return this.host.game;
  }

  public onAdded(_deps: TDeps): void {}

  public onUpdate(_update: WorldUpdate, _deps: TDeps): void {}

  public onDestroy(_deps: TDeps): void {}
}
