import './style.css';

import { Game, PhysicsWorld, initPhysics } from '@arcade2d/engine';
import { characters, furniture, props, terrain } from './assets';
import { buildMap } from './map';
import { PlayerPrefab } from './objects/player/player.prefab';

async function start(): Promise<void> {
  const game = await Game.bootstrap({
    backgroundColour: 0x12121c,
    canvas: { fill: 'window' },
    debug: true,
  });

  // Rapier is WebAssembly and must be initialised before any PhysicsWorld or
  // RigidBody is constructed.
  await initPhysics();

  // Preload every bundle up front so a missing or failed asset surfaces at
  // startup rather than when a particular object first spawns.
  await Promise.all([
    game.assets.use(characters).load(),
    game.assets.use(terrain).load(),
    game.assets.use(props).load(),
    game.assets.use(furniture).load(),
  ]);

  // Top-down world: no gravity, collisions only.
  const world = game.createWorld({
    components: (world) => ({
      physics: () => new PhysicsWorld(world, { gravity: { x: 0, y: 0 } }),
    }),
  });

  buildMap(world);

  // Player last so it renders above the scene and the spawned zombies.
  world.createFromPrefab(PlayerPrefab);
}

void start();
