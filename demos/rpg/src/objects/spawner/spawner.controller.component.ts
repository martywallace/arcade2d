import type { WorldObject, WorldUpdate } from '@arcade2d/engine';
import {
  AbstractWorldObjectComponent,
  Random,
  WorldTimer,
} from '@arcade2d/engine';
import { SPAWN_INTERVAL, SPAWN_JITTER, SPAWNER_CAP } from '../../constants';
import { ZombiePrefab } from '../zombie/zombie.prefab';

/**
 * Keeps a fixed number of zombies alive around a spawn point. The point itself
 * is invisible — this controller is its whole behaviour.
 *
 * It holds references to the zombies it has spawned and prunes them as they
 * die (detected via each object's `destroyed` flag, so no death event needs
 * wiring). Whenever the live count drops below {@link SPAWNER_CAP}, it
 * trickles a replacement back in on a timer. The cap is filled immediately on
 * attach so the world has enemies from the first frame.
 */
export class SpawnerController extends AbstractWorldObjectComponent {
  private readonly _alive: WorldObject[] = [];
  private readonly _respawn = new WorldTimer(SPAWN_INTERVAL);
  private readonly _random = new Random();

  public override onAdded(): void {
    for (let i = 0; i < SPAWNER_CAP; i++) {
      this._spawn();
    }
  }

  public override onUpdate(update: WorldUpdate): void {
    this._prune();

    if (this._alive.length >= SPAWNER_CAP) {
      return;
    }

    if (this._respawn.decrement(update.deltaMilliseconds).isLapsed) {
      this._spawn();
      this._respawn.reset();
    }
  }

  /** Drops references to zombies that have died since the last tick. */
  private _prune(): void {
    for (let i = this._alive.length - 1; i >= 0; i--) {
      const zombie = this._alive[i];

      if (!zombie || zombie.destroyed) {
        this._alive.splice(i, 1);
      }
    }
  }

  /** Spawns one zombie, scattered a little around the spawn point. */
  private _spawn(): void {
    const zombie = this.world.createFromPrefab(ZombiePrefab, {
      x:
        this.host.position.x +
        this._random.between(-SPAWN_JITTER, SPAWN_JITTER),
      y:
        this.host.position.y +
        this._random.between(-SPAWN_JITTER, SPAWN_JITTER),
    });

    this._alive.push(zombie);
  }
}
