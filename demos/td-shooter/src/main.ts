import './style.css';

import { bootstrap, Point } from '@arcade2d/engine';
import { PlayerPrefab } from './objects/player/player.prefab';
import { ZombiePrefab } from './objects/zombie/zombie.prefab';

async function start() {
  const { world } = await bootstrap({
    bindToWindow: true,
    renderOptions: {
      background: 0x1099bb,
      resizeTo: window,
    },
  });

  world.createFromPrefab(PlayerPrefab);

  for (let i = 0; i < 10; i++) {
    world.createFromPrefab(
      ZombiePrefab,
      new Point(Math.random() * 1000, Math.random() * 1000),
    );
  }
}

start();
