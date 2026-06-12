import { Circle, Prefab, RigidBody } from '@arcade2d/engine';
import { TAG, ZOMBIE_HEALTH, ZOMBIE_RADIUS } from '../../constants';
import { Health } from '../../components/health.component';
import { HealthBar } from '../../components/health-bar.component';
import { ZombieController } from './zombie.controller.component';

/**
 * An enemy zombie. Built like the player — a rotation-locked, zero-gravity
 * dynamic body so it collides with walls and other zombies — plus a
 * {@link Health} pool the player's bullets whittle down and a
 * {@link ZombieController} that homes in on the player.
 *
 * The root carries the logic and physics; its *visuals* hang off it as
 * children. The {@link ZombieController} owns a sprite child that turns to face
 * the player, and the {@link HealthBar} owns a small bar hierarchy that floats
 * upright above. Keeping the root unrotated is what lets the bar stay put while
 * the sprite spins — see {@link HealthBar} for the hierarchy.
 *
 * Tagged `enemy` so bullets know to damage it and zombie spawners can track the
 * live population.
 */
export const ZombiePrefab = new Prefab({
  name: 'zombie',
  tags: [TAG.enemy],
  components: {
    body: ({ object }) =>
      new RigidBody(object, {
        type: 'dynamic',
        gravityScale: 0,
        lockRotation: true,
        collider: { shape: new Circle(ZOMBIE_RADIUS) },
      }),
    health: ({ object }) => new Health(object, ZOMBIE_HEALTH),
    controller: ({ object }) => new ZombieController(object),
    healthBar: ({ object }) => new HealthBar(object),
  },
});
