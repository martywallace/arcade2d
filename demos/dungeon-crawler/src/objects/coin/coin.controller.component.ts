import type { WorldUpdate } from '@arcade2d/engine';
import { AbstractWorldObjectComponent, WorldTimer } from '@arcade2d/engine';
import { ScoreComponent } from '../../components/score.component';

/**
 * World-space radius within which the player picks up a coin. Sized to roughly
 * the overlap of the scaled coin and player sprites.
 */
const PICKUP_RADIUS = 40;

/**
 * Coins are inert pickups: each frame the controller checks whether the player
 * is close enough to collect it, and otherwise counts down a lifetime so
 * uncollected coins don't accumulate forever.
 *
 * On pickup it adds to the game-tier {@link ScoreComponent} and removes itself;
 * if the lifetime lapses first it just removes itself. Both paths end in
 * `host.destroy()`, which also tears down the sibling {@link AnimatedSprite}.
 */
export class CoinController extends AbstractWorldObjectComponent {
  // Coins vanish after ~10s if not picked up.
  private readonly _lifetime = new WorldTimer(10_000);

  public override onUpdate(update: WorldUpdate): void {
    const player = this.world.findOneByTag('player');

    if (player && this.host.position.distanceTo(player.position) < PICKUP_RADIUS) {
      this.game.getComponentByType(ScoreComponent).add(1);
      this.host.destroy();
      return;
    }

    if (this._lifetime.decrement(update.deltaMilliseconds).isLapsed) {
      this.host.destroy();
    }
  }
}
