import { Prefab, PolygonGraphics } from '@arcade2d/engine';
import { PlayerController } from './player.controller.component';

export const PlayerPrefab = new Prefab({
  name: 'player',
  tags: ['player'],
  components: {
    controller: ({ object }) => new PlayerController(object),
    graphics: ({ object }) =>
      PolygonGraphics.asRectangle(object, 50, 50, 0xffffff),
  },
});
