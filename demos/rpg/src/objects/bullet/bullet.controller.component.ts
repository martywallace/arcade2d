import type { WorldUpdate } from '@arcade2d/engine';
import { AbstractWorldObjectComponent, WorldTimer } from '@arcade2d/engine';
import { BULLET_LIFETIME } from '../../constants';

/**
 * Self-destructs a bullet that never hits anything. The bullet's motion is
 * driven entirely by its physics body (the player sets the launch velocity at
 * spawn), and impacts are handled by the body's collision listener — so this
 * controller's only job is the lifetime timeout that keeps stray bullets from
 * flying forever.
 */
export class BulletController extends AbstractWorldObjectComponent {
  private readonly _lifetime = new WorldTimer(BULLET_LIFETIME);

  public override onUpdate(update: WorldUpdate): void {
    if (this._lifetime.decrement(update.deltaMilliseconds).isLapsed) {
      this.host.destroy();
    }
  }
}
