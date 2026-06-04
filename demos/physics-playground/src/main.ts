import './style.css';

import {
  Game,
  initPhysics,
  PhysicsDebugRenderer,
  PhysicsWorld,
} from '@arcade2d/engine';
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

  // Flip to false to hide the collider outlines. The renderer is opt-in by
  // registration — there's no runtime cost when it isn't in the factory.
  const debugPhysics = true;

  const world = game.createWorld({
    components: (world) => ({
      physics: () => new PhysicsWorld(world, { gravity: { x: 0, y: 980 } }),
      spawner: () => new Spawner(world),
      ...(debugPhysics
        ? { physicsDebug: () => new PhysicsDebugRenderer(world) }
        : {}),
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
