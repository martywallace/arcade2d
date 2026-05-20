import type {
  Update,
  WorldObjectComponent,
  WorldObjectDependencyResolver,
} from '@arcade2d/engine';
import { SimpleGraphics, WorldObject } from '@arcade2d/engine';

/**
 * Bullet only needs a reference to its own visual so it can sync its
 * orientation when {@link BulletController.setAngle} is called externally
 * by the spawning {@link PlayerController}.
 */
type BulletDeps = {
  readonly graphics: SimpleGraphics;
};

export class BulletController implements WorldObjectComponent<BulletDeps> {
  private _angle = 0;
  private _lifetime = 1000;

  // Captured from the resolved deps in `onAdded` so the externally-called
  // setAngle method can reach the sibling component without doing its own
  // lookup. The non-null assertion is the user's contract: setAngle is
  // never invoked before onAdded has run — the spawning code calls it
  // immediately after `world.createFromPrefab` returns, at which point the
  // engine has already driven addComponents → resolveDependencies → onAdded.
  private _graphics!: SimpleGraphics;

  constructor(public readonly host: WorldObject) {}

  resolveDependencies(resolver: WorldObjectDependencyResolver): BulletDeps {
    return { graphics: resolver.requireSibling(SimpleGraphics) };
  }

  onAdded({ graphics }: BulletDeps) {
    this._graphics = graphics;
  }

  onUpdate(update: Update) {
    this.host.position.moveInDirection(this._angle, update.delta * 0.8);

    for (const object of this.host.world.findByTag('enemy')) {
      if (
        object
          .getComponentByType(SimpleGraphics)
          .getBounds()
          .containsPoint(this.host.position.x, this.host.position.y)
      ) {
        this.host.destroy();
        object.destroy();
      }
    }

    this._lifetime -= update.delta;

    if (this._lifetime < 0) {
      this.host.destroy();
    }
  }

  onDestroy() {}

  public setAngle(value: number) {
    this._angle = value;
    this._graphics.rotation = value;
  }
}
