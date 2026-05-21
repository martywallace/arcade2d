import { AnimatedSprite, ImageAsset, Prefab, Texture } from '@arcade2d/engine';
import { CHARACTER_SCALE, COIN_FRAME_KEYS, items } from '../../assets';
import { CoinController } from './coin.controller.component';

export const CoinPrefab = new Prefab({
  name: 'coin',
  tags: ['coin'],
  components: {
    controller: ({ object }) => new CoinController(object),
    graphics: ({ assets, object }) => {
      // Turn the four coin frame assets into ordered textures and hand them to
      // an AnimatedSprite for a continuous spin.
      const bundle = assets.use(items);
      const frames = COIN_FRAME_KEYS.map(
        (key) => new Texture(bundle.getAs(key, ImageAsset)),
      );

      object.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

      return new AnimatedSprite(object, frames, { fps: 8 });
    },
  },
});
