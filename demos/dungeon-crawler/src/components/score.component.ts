import { AbstractGameComponent } from '@arcade2d/engine';

/**
 * Game-tier store for global, world-independent values — currently the
 * player's score, but the natural home for anything that should outlive a
 * single {@link World} (high score, wave number, currency, run timer).
 *
 * It lives on the {@link Game} rather than the world because score is a
 * property of the play session, not of any one object: a coin's pickup
 * controller reaches it with `this.game.getComponentByType(ScoreComponent)`
 * and calls {@link ScoreComponent.add}, and a future HUD reads
 * {@link ScoreComponent.score} the same way.
 */
export class ScoreComponent extends AbstractGameComponent {
  private _score = 0;

  /**
   * The current score.
   */
  public get score(): number {
    return this._score;
  }

  /**
   * Adds points to the score (default `1`, the value of one coin) and returns
   * the new total.
   *
   * @param points How much to add. Defaults to `1`.
   * @returns The score after adding.
   */
  public add(points = 1): number {
    this._score += points;
    return this._score;
  }

  /**
   * Resets the score to zero — e.g. at the start of a new run.
   */
  public reset(): void {
    this._score = 0;
  }
}
