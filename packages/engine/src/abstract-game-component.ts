import { AbstractComponent } from './abstract-component';
import type { Component } from './components.types';
import type { Game } from './game';
import type { WorldUpdate } from './world/world-update';

/**
 * Abstract base class for components attached to a {@link Game}.
 *
 * Use this whenever you're writing a game-tier system — page-global input
 * samplers, asset registries, audio mixers, anything that conceptually
 * lives *outside* a {@link World}. The base supplies:
 *
 * - The {@link AbstractComponent.host} reference, typed as {@link Game}.
 * - A {@link AbstractGameComponent.game} alias (identical to `host` at
 *   this tier) so callers can use the same name they would on any other
 *   abstract base.
 * - No-op default implementations of the three required lifecycle hooks
 *   (`onAdded`, `onUpdate`, `onDestroy`) so subclasses override only the
 *   ones they care about. The optional `onPreUpdate` and `onPostUpdate`
 *   hooks remain opt-in — declare them only when you need them.
 *
 * The class satisfies the structural {@link Component} interface so
 * instances slot into any of the host's `addComponent` / `addComponents`
 * methods exactly like a hand-written component literal.
 *
 * ### A note on the `onUpdate` signature
 *
 * To match the structural {@link Component} interface, `onUpdate` accepts
 * a {@link WorldUpdate} as its first argument — but the {@link Game}
 * tier's runtime passes `undefined` here. The argument is currently
 * vestigial at this tier; ignore it in subclass overrides. A dedicated
 * `GameUpdate` payload is planned for a future iteration.
 *
 * @template TDeps The shape of the resolved dependencies threaded into
 * every lifecycle hook. Defaults to an empty object for components with
 * no dependencies — they can omit the `deps` parameter at each hook
 * entirely.
 *
 * @example
 * ```typescript
 * class FrameCounter extends AbstractGameComponent {
 *   public frames = 0;
 *
 *   public onUpdate(): void {
 *     this.frames += 1;
 *   }
 * }
 * ```
 */
export abstract class AbstractGameComponent<TDeps = Record<string, never>>
  extends AbstractComponent<Game>
  implements Component<Game, TDeps>
{
  /**
   * The {@link Game} this component is attached to — identical to
   * {@link AbstractComponent.host} at this tier, exposed under the
   * `game` name so subclass code reads the same on every tier.
   */
  public get game(): Game {
    return this.host;
  }

  public onAdded(_deps: TDeps): void {}

  public onUpdate(_update: WorldUpdate, _deps: TDeps): void {}

  public onDestroy(_deps: TDeps): void {}
}
