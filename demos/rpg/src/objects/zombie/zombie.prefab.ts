import {
  Circle,
  ImageAsset,
  Prefab,
  RigidBody,
  Sprite,
  Texture,
} from '@arcade2d/engine';
import { characters } from '../../assets';
import {
  CHARACTER_SCALE,
  TAG,
  ZOMBIE_HEALTH,
  ZOMBIE_RADIUS,
} from '../../constants';
import { Health } from '../../components/health.component';
import { ZombieController } from './zombie.controller.component';

/**
 * An enemy zombie. Built like the player — a rotation-locked, zero-gravity
 * dynamic body so it collides with walls and other zombies — plus a
 * {@link Health} pool the player's bullets whittle down and a
 * {@link ZombieController} that homes in on the player.
 *
 * Tagged `enemy` so bullets know to damage it and zombie spawners can track the
 * live population.
 */
export const ZombiePrefab = new Prefab({
  name: 'zombie',
  tags: [TAG.enemy],
  components: {
    graphics: ({ assets, object }) => {
      const asset = assets.use(characters).getAs('zombie', ImageAsset);
      object.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

      return new Sprite(object, new Texture(asset));
    },
    body: ({ object }) =>
      new RigidBody(object, {
        type: 'dynamic',
        gravityScale: 0,
        lockRotation: true,
        collider: { shape: new Circle(ZOMBIE_RADIUS) },
      }),
    health: ({ object }) => new Health(object, ZOMBIE_HEALTH),
    controller: ({ object }) => new ZombieController(object),
  },
});
