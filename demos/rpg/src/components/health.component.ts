import { AbstractWorldObjectComponent, WorldObject } from '@arcade2d/engine';

/**
 * A hit-point pool that destroys its host when depleted. Attached to anything
 * that can be killed (currently zombies); a bullet that hits the host calls
 * {@link Health.damage} from its collision listener.
 *
 * The component owns the "death" decision — once HP reaches zero it destroys
 * the host object, whose teardown cascades to any children. Spawners notice the
 * death by polling their tracked objects' `destroyed` flag, so no explicit
 * death event needs to be wired up.
 */
export class Health extends AbstractWorldObjectComponent {
  private _hp: number;

  constructor(host: WorldObject, maxHp: number) {
    super(host);
    this._hp = maxHp;
  }

  /** Remaining hit points. Never reported below zero. */
  public get hp(): number {
    return Math.max(0, this._hp);
  }

  /**
   * Applies damage. The first hit that drops HP to zero destroys the host;
   * further damage on an already-dead host is ignored, so a multi-hit frame
   * can't trigger a double destroy.
   *
   * @param amount Hit points to remove. Expected positive.
   */
  public damage(amount: number): void {
    if (this._hp <= 0) {
      return;
    }

    this._hp -= amount;

    if (this._hp <= 0) {
      this.host.destroy();
    }
  }
}
