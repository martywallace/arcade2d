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
} from '../../constants';
import { Health } from '../../components/health.component';

/** How close the zombie's centre must be to the player's to land a bite. */
const ATTACK_RANGE = PLAYER_RADIUS + ZOMBIE_RADIUS + 4;

/**
 * Walks a zombie toward the player, turns it to face them, and bites them for
 * contact damage while pressed against them. Movement is by physics velocity,
 * so walls and other zombies block it through the solver (no pathfinding —
 * bumping into a wall is fine for this showcase).
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

  // Per-zombie bite cooldown, so a single zombie pressed against the player
  // chews at a fixed rate while a whole swarm stacks damage from each member.
  private readonly _attackCooldown = new WorldTimer(ZOMBIE_ATTACK_INTERVAL);

  public override onAdded(): void {
    this._body = this.host.getComponentByType(RigidBody);

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
      graphics: (object) => new Sprite(object, new Texture(asset)),
    });
  }

  public override onUpdate(update: WorldUpdate): void {
    const player = this.world.findOneByTag('player');

    if (!player) {
      this._body.velocity = { x: 0, y: 0 };

      return;
    }

    const angle = this.host.position.angleTo(player.position);
    this._sprite.rotation = angle;
    this._body.velocity = {
      x: Math.cos(angle) * ZOMBIE_SPEED,
      y: Math.sin(angle) * ZOMBIE_SPEED,
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

  public override onDestroy(): void {
    // A little kinetic feedback when one goes down.
    this.world.camera.shake(8, 180);
  }
}
