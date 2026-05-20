import { AbstractComponent } from '../abstract-component';
import type { Game } from '../game';
import type { WorldObjectComponent } from './dependencies.types';
import type { World } from './world';
import type { WorldObject } from './world-object';
import type { WorldUpdate } from './world-update';

/**
 * Abstract base class for components attached to a {@link WorldObject}.
 *
 * The recommended way to implement the {@link WorldObjectComponent}
 * contract. Supplies the boilerplate every per-object system would
 * otherwise write by hand:
 *
 * - The {@link AbstractComponent.host} reference, typed as
 *   {@link WorldObject}.
 * - A {@link AbstractWorldObjectComponent.world} accessor that hops
 *   through the host to the parent {@link World} — the short-hand for
 *   the very common `this.host.world.findOneByTag(...)` /
 *   `this.host.world.camera.shake(...)` patterns.
 * - A {@link AbstractWorldObjectComponent.game} accessor that hops
 *   one further through the world to the {@link Game} — the single-step
 *   way to reach page-scoped services like the keyboard or mouse
 *   samplers from inside per-object behaviour code.
 * - No-op default implementations of the required lifecycle hooks
 *   (`onAdded`, `onUpdate`, `onDestroy`) so subclasses only override
 *   the ones they actually use.
 *
 * Subclasses that take additional constructor arguments must define
 * their own constructor and forward `host` via `super(host)`.
 *
 * @template TDeps The shape of the resolved dependencies threaded into
 * every lifecycle hook. Defaults to an empty object for components with
 * no dependencies — they can omit the `deps` parameter at each hook
 * entirely.
 *
 * @example
 * ```typescript
 * class WASDController extends AbstractWorldObjectComponent {
 *   public onUpdate(update: WorldUpdate): void {
 *     const keys = this.game.getKeyboardState();
 *     const speed = 0.2 * update.deltaMilliseconds;
 *
 *     if (keys.isDown('KeyW')) this.host.position.y -= speed;
 *     if (keys.isDown('KeyS')) this.host.position.y += speed;
 *     if (keys.isDown('KeyA')) this.host.position.x -= speed;
 *     if (keys.isDown('KeyD')) this.host.position.x += speed;
 *   }
 * }
 * ```
 */
export abstract class AbstractWorldObjectComponent<
  TDeps = Record<string, never>,
>
  extends AbstractComponent<WorldObject>
  implements WorldObjectComponent<TDeps>
{
  /**
   * The {@link World} the host {@link WorldObject} lives in. Shorthand
   * for `this.host.world`.
   */
  public get world(): World {
    return this.host.world;
  }

  /**
   * The {@link Game} the host's world belongs to. Always non-null —
   * the world's `game` field is a mandatory construction argument, not
   * an option.
   */
  public get game(): Game {
    return this.host.world.game;
  }

  public onAdded(_deps: TDeps): void {}

  public onUpdate(_update: WorldUpdate, _deps: TDeps): void {}

  public onDestroy(_deps: TDeps): void {}
}
