import { ImageAsset, Prefab, Sprite, Texture } from '@arcade2d/engine';
import { CHARACTER_SCALE, characters } from '../../assets';
import { ZombieController } from './zombie.controller.component';

export const ZombiePrefab = new Prefab({
  name: 'zombie',
  tags: ['enemy'],
  components: {
    controller: ({ object }) => new ZombieController(object),
    graphics: ({ assets, object }) => {
      const asset = assets.use(characters).getAs('zombie', ImageAsset);
      object.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

      return new Sprite(object, new Texture(asset));
    },
  },
});
