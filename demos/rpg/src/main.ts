import './style.css';

import { Game, PhysicsWorld, initPhysics } from '@arcade2d/engine';
import { characters, sfx, terrain, tilesheet } from './assets';
import { FlowField } from './components/flow-field.component';
import { KillCount } from './components/kill-count.component';
import { buildMap } from './map';
import { HudPrefab } from './objects/hud/hud.prefab';
import { PlayerPrefab } from './objects/player/player.prefab';

async function start(): Promise<void> {
  const game = await Game.bootstrap({
    backgroundColour: 0x12121c,
    canvas: { fill: 'window' },
    debug: true,
    // Game-tier kill tally — outlives the world and is reached by the bullet
    // (to score) and the HUD (to display).
    components: (game) => ({
      kills: () => new KillCount(game),
    }),
  });

  // Rapier is WebAssembly and must be initialised before any PhysicsWorld or
  // RigidBody is constructed.
  await initPhysics();

  // Preload every bundle up front so a missing or failed asset surfaces at
  // startup rather than when a particular object first spawns.
  await Promise.all([
    game.assets.use(characters).load(),
    game.assets.use(terrain).load(),
    game.assets.use(tilesheet).load(),
    game.assets.use(sfx).load(),
  ]);

  // Browsers suspend the AudioContext until the page sees a user gesture, so
  // resume it on the first click or key press — until then the gunshot SFX would
  // decode fine but play silently. One-shot listeners: once unlocked, the
  // context stays running for the rest of the session.
  const unlockAudio = (): void => {
    void game.audio.resume();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Top-down world: no gravity, collisions only. The shared FlowField gives the
  // zombie horde a single navigation map to route around the houses and props.
  const world = game.createWorld({
    components: (world) => ({
      physics: () => new PhysicsWorld(world, { gravity: { x: 0, y: 0 } }),
      flow: () => new FlowField(world),
    }),
  });

  buildMap(world);

  // Player above the scene and the spawned zombies.
  world.createFromPrefab(PlayerPrefab);

  // HUD last so it parents above everything in the scene graph.
  world.createFromPrefab(HudPrefab);
}

void start();
