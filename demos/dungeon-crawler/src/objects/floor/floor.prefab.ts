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

      // Large and centred on the origin (where the player spawns). A static
      // world-positioned floor scrolls correctly under the following camera
      // via the scene transform; making it big means the camera never reaches
      // an edge in a normal play session. TilingSprite is a single draw call
      // regardless of how many tiles that is.
      return new TilingSprite(object, tile, {
        width: 12000,
        height: 12000,
        tileScale: CHARACTER_SCALE,
      });
    },
  },
});
