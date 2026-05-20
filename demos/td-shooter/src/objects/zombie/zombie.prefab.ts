import { Prefab, SimpleGraphics } from '@arcade2d/engine';
import { ZombieController } from './zombie.controller.component';

export const ZombiePrefab = new Prefab({
  name: 'zombie',
  tags: ['enemy'],
  components: {
    controller: ({ object }) => new ZombieController(object),
    graphics: ({ object }) =>
      SimpleGraphics.solidRectangle(object, 40, 40, 0xff3333),
  },
});
