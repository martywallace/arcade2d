import { AbstractWorldObjectComponent, Scene, Text } from '@arcade2d/engine';
import { ScoreComponent } from '../../components/score.component';

/**
 * Distance in screen pixels between the score label and the canvas's top-left
 * corner. Picked to sit clear of the canvas edge at the demo's typical sizes
 * without floating awkwardly far inward.
 */
const MARGIN = 16;

/**
 * Updates the score HUD each frame: keeps the host pinned to the top-left of
 * the visible world (via the {@link Scene}'s screen-to-world conversion, so it
 * follows the camera without doing the maths by hand), and writes the current
 * {@link ScoreComponent.score} into the sibling {@link Text}.
 *
 * The text is only re-set when the score actually changes — PIXI's `Text`
 * re-rasterises on every assignment, so writing the same string each frame
 * would churn the GPU texture for no visual change.
 */
export class ScoreDisplayController extends AbstractWorldObjectComponent {
  private _lastScore = Number.NaN;

  public override onUpdate(): void {
    const scene = this.world.getComponentByType(Scene);
    const topLeft = scene.screenToWorld({ x: MARGIN, y: MARGIN });
    this.host.position.copyFrom(topLeft);

    const score = this.game.getComponentByType(ScoreComponent).score;
    if (score !== this._lastScore) {
      const text = this.host.getComponentByType(Text);
      text.setText(`Score ${score}`);
      this._lastScore = score;
    }
  }
}
