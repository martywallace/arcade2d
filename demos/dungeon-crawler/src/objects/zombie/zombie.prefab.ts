import { ImageAsset, Prefab, Sprite, Texture } from '@arcade2d/engine';
import { CHARACTER_SCALE, characters } from '../../assets';
import { ZombieController } from './zombie.controller.component';

export const ZombiePrefab = new Prefab({
  name: 'zombie',
  tags: ['enemy'],
  components: {
    controller: ({ object }) => new ZombieController(object),
    graphics: ({ world, object }) => {
      const asset = world.game.assets.use(characters).get('zombie');
      object.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

      return new Sprite(object, new Texture(asset as ImageAsset));
    },
  },
});
