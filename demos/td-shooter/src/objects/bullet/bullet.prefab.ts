import { Prefab, SimpleGraphics } from '@arcade2d/engine';
import { BulletController } from './bullet.controller.component';

export const BulletPrefab = new Prefab({
  name: 'bullet',
  components: ({ world, object }) => ({
    controller: () => new BulletController(object),
    graphics: () => SimpleGraphics.solidRectangle(object, 8, 3, 0x00cc11),
  }),
});
