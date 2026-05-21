import { Prefab, PolygonGraphics } from '@arcade2d/engine';
import { ZombieController } from './zombie.controller.component';

export const ZombiePrefab = new Prefab({
  name: 'zombie',
  tags: ['enemy'],
  components: {
    controller: ({ object }) => new ZombieController(object),
    graphics: ({ object }) =>
      PolygonGraphics.asRectangle(object, 40, 40, 0xff3333),
  },
});
