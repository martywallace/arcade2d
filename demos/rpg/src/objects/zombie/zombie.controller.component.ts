import type { WorldObject, WorldUpdate } from '@arcade2d/engine';
import {
  AbstractWorldObjectComponent,
  ImageAsset,
  RigidBody,
  Sprite,
  Texture,
  WorldTimer,
} from '@arcade2d/engine';
import { characters } from '../../assets';
import {
  CHARACTER_SCALE,
  PLAYER_RADIUS,
  ZOMBIE_ATTACK_INTERVAL,
  ZOMBIE_DAMAGE,
  ZOMBIE_RADIUS,
  ZOMBIE_SPEED,
  ZOMBIE_TURN_RATE,
} from '../../constants';
import { layers } from '../../layers';
import { FlowField } from '../../components/flow-field.component';
import { Health } from '../../components/health.component';

/** How close the zombie's centre must be to the player's to land a bite. */
const ATTACK_RANGE = PLAYER_RADIUS + ZOMBIE_RADIUS + 4;

/**
 * Walks a zombie toward the player, turns it to face them, and bites them for
 * contact damage while pressed against them. Movement is by physics velocity,
 * so walls and other zombies block it through the solver.
 *
 * ## Heading: line-of-sight seek, else the flow field
 *
 * Each frame the zombie picks a heading two ways:
 *
 * - **Clear line of sight** to the player ({@link FlowField.hasClearPath}) — it
 *   seeks the player directly, for a smooth straight chase across open ground.
 * - **Occluded** by a wall — it follows the shared {@link FlowField}, whose
 *   downhill direction routes the whole horde around the houses and props.
 *
 * The chosen heading is not applied raw: the zombie's facing eases toward it at
 * {@link ZOMBIE_TURN_RATE}, so a sharply different direction (the flow field
 * steers in 45-degree steps) sweeps in over a few frames rather than snapping.
 * Both the sprite *and* the velocity follow that eased facing, so the body banks
 * into the turn — it never moves one way while pointing another.
 *
 * Either way it only sets a *desired* velocity; the physics solver does the
 * actual collision resolution (sliding along angled walls, shoving through the
 * pile). The field falls back to a direct seek before it has finished building
 * on the first frame.
 *
 * ## A stable root with a turning child
 *
 * The zombie's facing is applied to a **child** sprite, not the host root. The
 * root stays unrotated so the things parented to it that should *not* spin with
 * the zombie — chiefly the {@link HealthBar} — ride along upright and stay put
 * above it. The sprite child carries the look-at rotation on its own.
 *
 * The body is rotation-locked, so the simulation never spins the root either;
 * the controller just drives velocity and points the sprite child. Death is
 * handled by the {@link Health} sibling, which destroys the host when its HP
 * runs out (cascading to the sprite and bar children); this controller only
 * adds the camera-shake flourish on the way out.
 */
export class ZombieController extends AbstractWorldObjectComponent {
  private _body!: RigidBody;
  private _sprite!: WorldObject;
  private _field!: FlowField;

  // Current facing, eased toward the desired heading each frame. Seeded on the
  // first tick (see `_turnToward`) so a freshly spawned zombie points where it
  // means to go instead of spinning up from zero.
  private _facing = 0;
  private _facingReady = false;

  // Per-zombie bite cooldown, so a single zombie pressed against the player
  // chews at a fixed rate while a whole swarm stacks damage from each member.
  private readonly _attackCooldown = new WorldTimer(ZOMBIE_ATTACK_INTERVAL);

  public override onAdded(): void {
    this._body = this.host.getComponentByType(RigidBody);
    this._field = this.world.getComponentByType(FlowField);

    // The visible zombie is a child of the (non-rotating) root, so it can turn
    // to face the player without dragging upright children like the health bar
    // around with it.
    this._sprite = this.world.createEmpty();
    this.host.addChild(this._sprite);
    // Pin to the root's origin. addChild defaults to keepWorldTransform, which
    // would otherwise bake in a local offset to hold the child at world (0,0)
    // instead of on the zombie.
    this._sprite.position.set(0, 0);
    this._sprite.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

    const asset = this.game.assets.use(characters).getAs('zombie', ImageAsset);
    this._sprite.addComponentsFromFactories({
      graphics: (object) =>
        new Sprite(object, new Texture(asset), {
          layer: layers.get('characters'),
        }),
    });
  }

  public override onUpdate(update: WorldUpdate): void {
    const player = this.world.findOneByTag('player');

    if (!player) {
      this._body.velocity = { x: 0, y: 0 };

      return;
    }

    // Seek the player directly when nothing's in the way; otherwise steer along
    // the flow field, which routes around the obstacle the line of sight hit.
    let target: number;

    if (this._field.hasClearPath(this.host.position, player.position)) {
      target = this.host.position.angleTo(player.position);
    } else {
      const flow = this._field.directionAt(this.host.position);
      target = flow
        ? Math.atan2(flow.y, flow.x)
        : this.host.position.angleTo(player.position);
    }

    // Ease toward the desired heading rather than snapping, then drive both the
    // facing and the movement from the result so the zombie banks into the turn.
    const facing = this._turnToward(target, update.deltaMilliseconds);

    this._sprite.rotation = facing;
    this._body.velocity = {
      x: Math.cos(facing) * ZOMBIE_SPEED,
      y: Math.sin(facing) * ZOMBIE_SPEED,
    };

    // Bite the player when pressed against them and the cooldown has elapsed.
    // The timer ticks every frame so the first contact lands immediately.
    const inReach =
      this.host.position.distanceTo(player.position) <= ATTACK_RANGE;

    if (this._attackCooldown.decrement(update.deltaMilliseconds).isLapsed) {
      if (inReach) {
        player.getNullableComponentByType(Health)?.damage(ZOMBIE_DAMAGE);
        this._attackCooldown.reset();
      }
    }
  }

  /**
   * Steps `_facing` toward `target` by at most {@link ZOMBIE_TURN_RATE} this
   * frame and returns it. Turns take the shortest way round (the difference is
   * wrapped to [-PI, PI]), so a heading that flips across the +/-PI seam still
   * turns the short way. The very first call seeds the facing to the target
   * outright so a new zombie doesn't spin up from a default angle.
   */
  private _turnToward(target: number, deltaMs: number): number {
    if (!this._facingReady) {
      this._facingReady = true;
      this._facing = target;

      return target;
    }

    const delta = Math.atan2(
      Math.sin(target - this._facing),
      Math.cos(target - this._facing),
    );
    const maxStep = (ZOMBIE_TURN_RATE * deltaMs) / 1000;

    this._facing +=
      Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;

    return this._facing;
  }

  public override onDestroy(): void {
    // A little kinetic feedback when one goes down.
    this.world.camera.shake(8, 180);
  }
}
