import { AbstractWorldObjectComponent, RigidBody } from '@arcade2d/engine';
import { ZOMBIE_SPEED } from '../../constants';

/**
 * Walks a zombie toward the player and turns it to face them. Movement is by
 * physics velocity, so walls and other zombies block it through the solver
 * (no pathfinding — bumping into a wall is fine for this showcase).
 *
 * Like the player, the body is rotation-locked, so `host.rotation` is written
 * here in the update phase to aim the sprite at the player for this frame's
 * render. Death is handled by the {@link Health} sibling, which destroys the
 * host when its HP runs out; this controller just adds the camera-shake
 * flourish on the way out.
 */
export class ZombieController extends AbstractWorldObjectComponent {
  private _body!: RigidBody;

  public override onAdded(): void {
    this._body = this.host.getComponentByType(RigidBody);
  }

  public override onUpdate(): void {
    const player = this.world.findOneByTag('player');

    if (!player) {
      this._body.velocity = { x: 0, y: 0 };

      return;
    }

    const angle = this.host.position.angleTo(player.position);
    this.host.rotation = angle;
    this._body.velocity = {
      x: Math.cos(angle) * ZOMBIE_SPEED,
      y: Math.sin(angle) * ZOMBIE_SPEED,
    };
  }

  public override onDestroy(): void {
    // A little kinetic feedback when one goes down.
    this.world.camera.shake(8, 180);
  }
}
