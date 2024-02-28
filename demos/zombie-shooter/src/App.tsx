import { useEffect, useRef } from 'react';
import { Point, Prefab, Scene, SimpleGraphics, World } from '@arcade2d/engine';
import { Application } from 'pixi.js';
import { PlayerController } from './player';

function App() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) {
      const app = new Application({
        view: ref.current,
        resizeTo: window,
      });

      const world = new World({
        components: (world) => ({
          scene: () => new Scene(world, app),
        }),
      });

      const prefab = new Prefab({
        name: 'player',
        components: (world, object) => ({
          graphics: () => {
            const graphics = new SimpleGraphics(object);

            graphics.beginFill(0xff0000);
            graphics.drawRect(-25, -25, 50, 50);
            graphics.endFill();

            return graphics;
          },
          controller: () => new PlayerController(object),
        }),
      });

      world.create(prefab, new Point(50, 50));

      app.ticker.add(() => {
        world.update();
      });

      return () => {
        world.destroy();
        // app.destroy();
      };
    }
  }, [ref]);

  return (
    <main>
      <canvas ref={ref} width={800} height={500} />
    </main>
  );
}

export default App;
