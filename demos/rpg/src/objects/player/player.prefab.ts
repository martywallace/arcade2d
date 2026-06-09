import {
  Circle,
  ImageAsset,
  Prefab,
  RigidBody,
  Sprite,
  Texture,
} from '@arcade2d/engine';
import { characters } from '../../assets';
import { CHARACTER_SCALE, PLAYER_RADIUS, TAG } from '../../constants';
import { PlayerController } from './player.controller.component';

/**
 * The player character. A rotation-locked, zero-gravity dynamic body (so it
 * slides along walls instead of passing through them), a survivor sprite that
 * turns to face the cursor, and the {@link PlayerController} that ties input,
 * aiming, the camera, and firing together.
 */
export const PlayerPrefab = new Prefab({
  name: 'player',
  tags: [TAG.player],
  components: {
    graphics: ({ assets, object }) => {
      const asset = assets.use(characters).getAs('player', ImageAsset);
      object.scale.set(CHARACTER_SCALE, CHARACTER_SCALE);

      return new Sprite(object, new Texture(asset));
    },
    body: ({ object }) =>
      new RigidBody(object, {
        type: 'dynamic',
        gravityScale: 0,
        lockRotation: true,
        collider: { shape: new Circle(PLAYER_RADIUS) },
      }),
    controller: ({ object }) => new PlayerController(object),
  },
});
