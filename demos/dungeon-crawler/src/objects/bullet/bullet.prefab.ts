import {
  groupD8,
  Rectangle as PixiRectangle,
  Texture as PixiTexture,
} from 'pixi.js';
import { ImageAsset, Prefab, Sprite, Texture } from '@arcade2d/engine';
import { CHARACTER_SCALE, projectiles } from '../../assets';
import { BulletController } from './bullet.controller.component';

export const BulletPrefab = new Prefab({
  name: 'bullet',
  components: {
    controller: ({ object }) => new BulletController(object),
    graphics: ({ assets, object }) => {
      const asset = assets.use(projectiles).getAs('arrow', ImageAsset);

      // The source art points down (+Y), but the engine's rotation convention
      // is 0 = +X (right): a bullet fired rightward has rotation 0. PIXI's
      // `rotate` frame metadata is read-only post-construction and the engine
      // Texture doesn't surface it, so build the rotated PIXI texture directly
      // (90deg via groupD8.S, turning the down-pointing arrowhead to +X) and
      // feed it in through the Sprite's raw escape hatch. The sprite then
      // tracks host.rotation like any other graphic.
      const rotated = new PixiTexture({
        source: asset.raw.source,
        frame: new PixiRectangle(0, 0, asset.width, asset.height),
        rotate: groupD8.S,
      });

      object.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

      const sprite = new Sprite(object, new Texture(asset));
      sprite.raw.texture = rotated;

      return sprite;
    },
  },
});
