import { AbstractGameComponent } from '@arcade2d/engine';

/**
 * Game-tier tally of zombies the player has killed across the session.
 *
 * It lives on the {@link Game} rather than the world because the score is a
 * property of the play session, not of any one object: a bullet's collision
 * listener reaches it with `this.world.game.getComponentByType(KillCount)` and
 * calls {@link KillCount.add} on a killing blow, and the HUD reads
 * {@link KillCount.count} the same way.
 */
export class KillCount extends AbstractGameComponent {
  private _count = 0;

  /** The number of kills so far. */
  public get count(): number {
    return this._count;
  }

  /**
   * Records kills and returns the new total.
   *
   * @param amount How many to add. Defaults to `1`.
   * @returns The total after adding.
   */
  public add(amount = 1): number {
    this._count += amount;
    return this._count;
  }

  /** Resets the tally to zero — e.g. at the start of a new run. */
  public reset(): void {
    this._count = 0;
  }
}
