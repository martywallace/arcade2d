import './style.css';

import { Point, Prefab, Scene, SimpleGraphics, World } from '@arcade2d/engine';
import { Application } from 'pixi.js';
import { PlayerController } from './components/player-controller.component';

const app = new Application();

async function bootstrap() {
  await app.init({
    resizeTo: window,
    background: 0x1099bb,
  });

  document.querySelector('#app')?.appendChild(app.canvas);

  const world = new World({
    components: (world) => ({
      scene: () => new Scene(world, app),
    }),
  });

  const prefab = new Prefab({
    name: 'player',
    components: ({ world, object }) => ({
      graphics: (host) => {
        const graphics = new SimpleGraphics(host);

        graphics.rect(-25, -25, 50, 50);
        graphics.fill(0xffffff);

        return graphics;
      },
      controller: (host) => new PlayerController(host),
    }),
  });

  const player = world.createFromPrefab(prefab, new Point(50, 50));
  const other = world.createEmpty(new Point(100, 100));

  player.addComponentFromFactory(
    'graphics',
    (host) => {
      const component = new SimpleGraphics(host);

      component.rect(-25, -25, 50, 50);
      component.fill(0x00ffcc);

      return component;
    },
    {
      allowReplacement: true,
    },
  );

  app.ticker.add(() => {
    world.update();
  });

  // Attach to window for console interaction.
  (window as any)['world'] = world;
}

bootstrap();
