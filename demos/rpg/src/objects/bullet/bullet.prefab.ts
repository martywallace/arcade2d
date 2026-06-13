import { Circle, CircleGraphics, Prefab, RigidBody } from '@arcade2d/engine';
import { BULLET_DAMAGE, BULLET_RADIUS, TAG } from '../../constants';
import { layers } from '../../layers';
import { Health } from '../../components/health.component';
import { KillCount } from '../../components/kill-count.component';
import { BulletController } from './bullet.controller.component';

/**
 * A player bullet: a small physics-driven pellet that the player aims and
 * launches. It is the showcase for the engine's collision-event API.
 *
 * Its collider is a **sensor** — it reports overlaps without pushing anything,
 * so the bullet flies cleanly through the world and is removed the instant it
 * touches something rather than physically shoving its target. The
 * `onCollisionStart` listener decides what a touch means:
 *
 * - an `enemy` takes a point of damage and the bullet is consumed;
 * - a `structure` (a house wall or furniture) consumes the bullet;
 * - anything else (the firing player, another bullet) is ignored.
 *
 * The launch velocity is set by the player right after spawn, so the prefab
 * itself carries no direction.
 */
export const BulletPrefab = new Prefab({
  name: 'bullet',
  tags: [TAG.bullet],
  components: {
    graphics: ({ object }) =>
      new CircleGraphics(object, new Circle(BULLET_RADIUS), 0xffe066, {
        layer: layers.get('characters'),
      }),
    controller: ({ object }) => new BulletController(object),
    body: ({ object, world }) =>
      new RigidBody(object, {
        type: 'dynamic',
        gravityScale: 0,
        lockRotation: true,
        ccd: true, // fast pellet — sweep it so it can't tunnel a thin wall
        collider: { shape: new Circle(BULLET_RADIUS), isSensor: true },
        onCollisionStart: (event) => {
          const { tags } = event.otherObject.metadata;

          if (tags.has(TAG.enemy)) {
            const killed = event.otherObject
              .getNullableComponentByType(Health)
              ?.damage(BULLET_DAMAGE);

            // Only the blow that actually drops the zombie scores — `damage`
            // returns false for a corpse, so two pellets landing the same frame
            // can't both claim the kill.
            if (killed) {
              world.game.getComponentByType(KillCount).add();
            }

            object.destroy();
          } else if (tags.has(TAG.structure)) {
            object.destroy();
          }
        },
      }),
  },
});
