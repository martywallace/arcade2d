import './style.css';

import { Game, Point } from '@arcade2d/engine';
import { PlayerPrefab } from './objects/player/player.prefab';
import { ZombiePrefab } from './objects/zombie/zombie.prefab';

async function start() {
  const game = await Game.bootstrap({
    backgroundColour: 0x1099bb,
    canvas: { fill: 'window' },
    debug: true,
  });

  const world = game.createWorld();

  world.createFromPrefab(PlayerPrefab);

  for (let i = 0; i < 10; i++) {
    world.createFromPrefab(
      ZombiePrefab,
      new Point(Math.random() * 1000, Math.random() * 1000),
    );
  }
}

start();
