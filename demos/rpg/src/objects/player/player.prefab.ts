import {
  AudioAsset,
  AudioSource,
  Circle,
  ImageAsset,
  Prefab,
  RigidBody,
  Sprite,
  Texture,
} from '@arcade2d/engine';
import { characters, sfx } from '../../assets';
import {
  CHARACTER_SCALE,
  PLAYER_HEALTH,
  PLAYER_RADIUS,
  TAG,
} from '../../constants';
import { Health } from '../../components/health.component';
import { PlayerController } from './player.controller.component';

/**
 * The player character. A rotation-locked, zero-gravity dynamic body (so it
 * slides along walls instead of passing through them), a survivor sprite that
 * turns to face the cursor, and the {@link PlayerController} that ties input,
 * aiming, the camera, and firing together.
 *
 * An {@link AudioSource} carries the gunshot clip; {@link PlayerController}
 * resolves it on add and fires a fresh voice per shot, so rapid fire layers
 * overlapping reports rather than retriggering one.
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
    // Survives depletion (`destroyOnDeath: false`) — the controller respawns it
    // at full health instead, so the demo keeps running.
    health: ({ object }) =>
      new Health(object, PLAYER_HEALTH, { destroyOnDeath: false }),
    // The gunshot voice. Pulled a touch below full so a sustained burst doesn't
    // clip; the controller plays it on each shot.
    audio: ({ assets, object }) =>
      new AudioSource(object, assets.use(sfx).getAs('gunshot', AudioAsset), {
        volume: 0.5,
      }),
    controller: ({ object }) => new PlayerController(object),
  },
});
