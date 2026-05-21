import './style.css';

import { Game, Random } from '@arcade2d/engine';
import { characters, scenery } from './assets';
import { FloorPrefab } from './objects/floor/floor.prefab';
import { PlayerPrefab } from './objects/player/player.prefab';
import { ZombiePrefab } from './objects/zombie/zombie.prefab';

async function start() {
  const game = await Game.bootstrap({
    backgroundColour: 0x000000,
    canvas: { fill: 'window' },
    debug: true,
  });

  // Eagerly preload every bundle before any object spawns, so a missing or
  // failed asset surfaces here at startup rather than when a particular object
  // first appears mid-session.
  await Promise.all([
    game.assets.use(characters).load(),
    game.assets.use(scenery).load(),
  ]);

  const world = game.createWorld();

  // Floor first so it parents into the scene before the characters and renders
  // behind them.
  world.createFromPrefab(FloorPrefab);

  world.createFromPrefab(PlayerPrefab);

  for (let i = 0; i < 10; i++) {
    world.createFromPrefab(ZombiePrefab, new Random().inRing(0, 0, 500, 700));
  }
}

start();
