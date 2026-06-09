import { ImageAsset, Prefab, Texture, TilingSprite } from '@arcade2d/engine';
import { terrain } from '../../assets';

/**
 * The grass field the whole scene sits on: one large tiled sprite centred on
 * the origin. Spawn it first so it parents into the scene before anything else
 * and renders behind everything. It is purely visual — it has no collider, so
 * the world's bounds come from the walls and props, not the ground.
 */
export const GroundPrefab = new Prefab({
  name: 'ground',
  components: {
    grass: ({ assets, object }) => {
      const tile = new Texture(assets.use(terrain).getAs('grass', ImageAsset));

      return new TilingSprite(object, tile, { width: 8000, height: 8000 });
    },
  },
});
