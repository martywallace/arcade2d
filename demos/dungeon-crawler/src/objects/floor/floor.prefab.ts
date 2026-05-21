import { ImageAsset, Prefab, Texture, TilingSprite } from '@arcade2d/engine';
import { CHARACTER_SCALE, FLOOR_TILE_FRAME, scenery } from '../../assets';

/**
 * A large tiled floor centred on the origin. Spawn it before the characters
 * so it parents into the scene first and renders behind them.
 */
export const FloorPrefab = new Prefab({
  name: 'floor',
  components: {
    floor: ({ assets, object }) => {
      const tileset = assets.use(scenery).getAs('tileset', ImageAsset);
      const tile = new Texture(tileset, FLOOR_TILE_FRAME);

      return new TilingSprite(object, tile, {
        width: 4000,
        height: 4000,
        tileScale: CHARACTER_SCALE,
      });
    },
  },
});
