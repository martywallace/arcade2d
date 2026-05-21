import { ImageAsset, Prefab, Sprite, Texture } from '@arcade2d/engine';
import { CHARACTER_SCALE, characters } from '../../assets';
import { PlayerController } from './player.controller.component';

export const PlayerPrefab = new Prefab({
  name: 'player',
  tags: ['player'],
  components: {
    controller: ({ object }) => new PlayerController(object),
    graphics: ({ assets, object }) => {
      // Resolve the texture at build time through the typed bundle: the key
      // is compile-checked, getAs verifies the type (no cast), and the bundle
      // was preloaded at startup.
      const asset = assets.use(characters).getAs('player', ImageAsset);
      object.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

      return new Sprite(object, new Texture(asset));
    },
  },
});
