import { AbstractWorldObjectComponent, WorldObject } from '@arcade2d/engine';

/** Construction options for {@link Health}. */
interface HealthOptions {
  /**
   * Whether the killing blow destroys the host. Defaults to `true`. Set `false`
   * for hosts that outlive depletion and recover on their own (the player).
   */
  readonly destroyOnDeath?: boolean;
}

/**
 * A hit-point pool for anything that can be hurt. Zombies take damage from the
 * player's bullets; the player takes contact damage from zombies. A
 * {@link HealthBar} reads it to draw a depleting bar.
 *
 * ## Death
 *
 * By default the component owns the "death" decision — the first hit that drops
 * HP to zero destroys the host, whose teardown cascades to its children, and
 * spawners notice via the object's `destroyed` flag. Pass
 * {@link HealthOptions.destroyOnDeath} `false` for hosts that should survive
 * depletion and handle it themselves (the player zeroes out, then
 * {@link Health.restore}s on its next tick as a simple respawn).
 *
 * {@link Health.damage} reports whether *this* hit was the killing blow, so a
 * caller can score the kill without double-counting a corpse that several
 * bullets reach in the same frame.
 */
export class Health extends AbstractWorldObjectComponent {
  private _hp: number;
  private readonly _maxHp: number;
  private readonly _destroyOnDeath: boolean;

  constructor(host: WorldObject, maxHp: number, options: HealthOptions = {}) {
    super(host);
    this._hp = maxHp;
    this._maxHp = maxHp;
    this._destroyOnDeath = options.destroyOnDeath ?? true;
  }

  /** Remaining hit points. Never reported below zero. */
  public get hp(): number {
    return Math.max(0, this._hp);
  }

  /** Hit points at full health — the pool's starting and maximum value. */
  public get maxHp(): number {
    return this._maxHp;
  }

  /**
   * Remaining health as a `0`–`1` fraction of {@link Health.maxHp} — the value
   * a {@link HealthBar} scales its fill by.
   */
  public get ratio(): number {
    return this._maxHp > 0 ? this.hp / this._maxHp : 0;
  }

  /** Whether the pool is depleted. */
  public get isDead(): boolean {
    return this._hp <= 0;
  }

  /**
   * Applies damage. Damage to an already-dead host is ignored, so a multi-hit
   * frame can't trigger a double destroy (or double kill-count). When
   * `destroyOnDeath` is set (the default), the killing blow destroys the host.
   *
   * @param amount Hit points to remove. Expected positive.
   * @returns `true` if this hit was the one that emptied the pool — the killing
   * blow — and `false` otherwise (a non-fatal hit, or a hit on an already-dead
   * host).
   */
  public damage(amount: number): boolean {
    if (this._hp <= 0) {
      return false;
    }

    this._hp -= amount;

    if (this._hp <= 0) {
      if (this._destroyOnDeath) {
        this.host.destroy();
      }

      return true;
    }

    return false;
  }

  /** Refills the pool to {@link Health.maxHp}. */
  public restore(): void {
    this._hp = this._maxHp;
  }
}
