import type { WorldObject } from '@arcade2d/engine';
import {
  AbstractWorldObjectComponent,
  PolygonGraphics,
} from '@arcade2d/engine';
import { layers } from '../layers';
import {
  BAR_COLOUR_BACKDROP,
  healthFillColour,
  leftAnchoredRect,
} from './bar.support';
import { Health } from './health.component';

/** Bar geometry, in world pixels. */
const BAR_WIDTH = 32;
const BAR_HEIGHT = 6;
const INNER_WIDTH = 28;
const INNER_HEIGHT = 3;

/** How far above the host's origin the bar floats. */
const BAR_OFFSET_Y = -30;

/**
 * Floats a depleting health bar above its host, reading the {@link Health}
 * sibling each frame.
 *
 * ## Built from child objects
 *
 * The bar is a small object hierarchy parented under the host, which is the
 * point of doing it this way: the host owns *what its health is*, and the bar
 * is a separate visual that rides the host's position for free through the
 * transform hierarchy — no per-frame "copy the host's position onto the bar"
 * bookkeeping.
 *
 * ```
 * host (zombie)
 *  └─ barRoot        — backdrop rectangle, offset above the host
 *      └─ fill       — coloured rectangle, left-anchored so it empties rightward
 * ```
 *
 * `fill` is anchored at its left edge (its local origin sits there), so scaling
 * its x by the health fraction shrinks it toward the left rather than from the
 * centre — the familiar "drains to the right" health-bar behaviour. The fill
 * also lerps green→red as it empties.
 *
 * The bar deliberately stays **unrotated**: the host (a zombie) keeps a stable,
 * non-rotating root — its sprite turns to face the player on a separate child —
 * so the bar rides along upright and always sits above the host. The whole
 * hierarchy is torn down automatically when the host is destroyed.
 */
export class HealthBar extends AbstractWorldObjectComponent {
  private _health!: Health;
  private _fill!: WorldObject;
  private _fillGraphics!: PolygonGraphics;

  // Cache the last drawn fraction so a bar at steady health does no work — no
  // rescale, no recolour-redraw — on the frames between hits.
  private _lastRatio = -1;

  public override onAdded(): void {
    this._health = this.host.getComponentByType(Health);

    // Backdrop: a dark rounded slab centred above the host.
    const barRoot = this.world.createEmpty();
    this.host.addChild(barRoot);
    barRoot.position.set(0, BAR_OFFSET_Y);
    barRoot.addComponentsFromFactories({
      graphics: (object) =>
        PolygonGraphics.asRectangle(
          object,
          BAR_WIDTH,
          BAR_HEIGHT,
          BAR_COLOUR_BACKDROP,
          { layer: layers.get('ui') },
        ),
    });

    // Fill: a left-anchored rectangle (origin at its left edge) so scaling x by
    // the health fraction drains it rightward. Sits inside the backdrop's
    // border and one tile above, as a child of the backdrop.
    this._fill = this.world.createEmpty();
    barRoot.addChild(this._fill);
    this._fill.position.set(-INNER_WIDTH / 2, 0);
    this._fill.addComponentsFromFactories({
      graphics: (object) => {
        this._fillGraphics = new PolygonGraphics(
          object,
          leftAnchoredRect(INNER_WIDTH, INNER_HEIGHT),
          healthFillColour(1),
          { layer: layers.get('ui') },
        );

        return this._fillGraphics;
      },
    });

    this._sync();
  }

  public override onUpdate(): void {
    this._sync();
  }

  /** Resizes and recolours the fill to match current health, when it changed. */
  private _sync(): void {
    const ratio = this._health.ratio;

    if (ratio === this._lastRatio) {
      return;
    }

    this._lastRatio = ratio;
    this._fill.scale.set(ratio, 1);
    this._fillGraphics.setFill(healthFillColour(ratio));
  }
}
