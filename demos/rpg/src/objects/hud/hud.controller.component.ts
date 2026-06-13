import type { WorldObject } from '@arcade2d/engine';
import {
  AbstractWorldObjectComponent,
  PolygonGraphics,
  Scene,
  Text,
} from '@arcade2d/engine';
import { layers } from '../../layers';
import {
  BAR_COLOUR_BACKDROP,
  healthFillColour,
  leftAnchoredRect,
} from '../../components/bar.support';
import { Health } from '../../components/health.component';
import { KillCount } from '../../components/kill-count.component';

/** Inset of the HUD from the canvas's top-left corner, in screen pixels. */
const MARGIN = 16;

/** HP-bar geometry, in screen pixels. */
const BAR_WIDTH = 168;
const BAR_HEIGHT = 18;
const BAR_PAD = 3;
const INNER_WIDTH = BAR_WIDTH - 2 * BAR_PAD;
const INNER_HEIGHT = BAR_HEIGHT - 2 * BAR_PAD;

/** Gap between the HP bar's bottom and the kills line. */
const ROW_GAP = 10;

/**
 * Drives the on-screen HUD: a player HP bar and the running kill count, pinned
 * to the top-left of the canvas.
 *
 * ## Screen-fixed via camera tracking
 *
 * The engine has no separate screen-space layer — every graphic lives in the
 * world and moves with the {@link Camera}. To make the HUD *look* fixed, each
 * frame this controller asks the {@link Scene} for the world point under the
 * screen's top-left corner ({@link Scene.screenToWorld}) and parks the host
 * there; the bar and label are children at fixed local offsets, so they ride
 * along and stay in the corner.
 *
 * ## Built from child objects
 *
 * ```
 * host (hud root)      — pinned to the screen corner each frame
 *  ├─ backdrop         — dark slab behind the HP bar
 *  ├─ fill             — coloured HP rectangle, left-anchored so it drains right
 *  └─ kills            — Text below the bar
 * ```
 *
 * The HP `fill` reuses the same left-anchored-rectangle trick as the enemy
 * {@link HealthBar}: scaling its x by the player's health fraction drains it
 * rightward and it lerps green→red. The text is only re-set when the count
 * changes, since PIXI re-rasterises `Text` on every assignment.
 */
export class HudController extends AbstractWorldObjectComponent {
  private _fill!: WorldObject;
  private _fillGraphics!: PolygonGraphics;
  private _kills!: Text;

  private _lastRatio = -1;
  private _lastKills = Number.NaN;

  public override onAdded(): void {
    // Backdrop slab; its centre sits at (W/2, H/2) so its top-left lands on the
    // host origin (the screen corner the host is pinned to).
    const backdrop = this.world.createEmpty();
    this.host.addChild(backdrop);
    backdrop.position.set(BAR_WIDTH / 2, BAR_HEIGHT / 2);
    backdrop.addComponentsFromFactories({
      graphics: (object) =>
        PolygonGraphics.asRectangle(
          object,
          BAR_WIDTH,
          BAR_HEIGHT,
          BAR_COLOUR_BACKDROP,
          { layer: layers.get('ui') },
        ),
    });

    // Fill, left-anchored inside the backdrop's border. Explicit position.set
    // after addChild: addChild defaults to keepWorldTransform and would
    // otherwise bake in an offset to hold the child where it spawned.
    this._fill = this.world.createEmpty();
    this.host.addChild(this._fill);
    this._fill.position.set(BAR_PAD, BAR_HEIGHT / 2);
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

    // Kills line, below the bar.
    const kills = this.world.createEmpty();
    this.host.addChild(kills);
    kills.position.set(0, BAR_HEIGHT + ROW_GAP);
    kills.addComponentsFromFactories({
      text: (object) => {
        this._kills = new Text(object, 'Kills  0', {
          fontSize: 18,
          fill: 0xffffff,
          anchor: 0,
          layer: layers.get('ui'),
        });

        return this._kills;
      },
    });

    this._sync();
  }

  public override onUpdate(): void {
    const scene = this.world.getComponentByType(Scene);
    this.host.position.copyFrom(scene.screenToWorld({ x: MARGIN, y: MARGIN }));

    this._sync();
  }

  /** Pushes current health and kill count into the bar and label, when changed. */
  private _sync(): void {
    const ratio =
      this.world.findOneByTag('player')?.getNullableComponentByType(Health)
        ?.ratio ?? 0;

    if (ratio !== this._lastRatio) {
      this._lastRatio = ratio;
      this._fill.scale.set(ratio, 1);
      this._fillGraphics.setFill(healthFillColour(ratio));
    }

    const kills = this.game.getComponentByType(KillCount).count;

    if (kills !== this._lastKills) {
      this._lastKills = kills;
      this._kills.setText(`Kills  ${kills}`);
    }
  }
}
