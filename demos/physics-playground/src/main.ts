import './style.css';

import { Game, initPhysics, PhysicsWorld } from '@arcade2d/engine';
import { createBall } from './objects/ball';
import { createBox } from './objects/box';
import { createBin } from './objects/bin';
import { Spawner } from './spawner';

async function start(): Promise<void> {
  const game = await Game.bootstrap({
    backgroundColour: 0x12121c,
    canvas: { width: 960, height: 640 },
    debug: true,
  });

  // Rapier is WebAssembly — initialise it before building a world that uses a
  // PhysicsWorld, the same way assets are preloaded before createWorld.
  await initPhysics();

  const world = game.createWorld({
    components: (world) => ({
      physics: () => new PhysicsWorld(world, { gravity: { x: 0, y: 980 } }),
      spawner: () => new Spawner(world),
    }),
  });

  createBin(world);

  // Seed the bin with an initial pile so there's something happening on load.
  for (let i = 0; i < 14; i++) {
    const position = {
      x: (Math.random() - 0.5) * 560,
      y: -260 + Math.random() * 120,
    };

    (Math.random() < 0.5 ? createBox : createBall)(world, position);
  }
}

void start();
