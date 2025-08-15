import { Application, ApplicationOptions } from 'pixi.js';
import { Scene } from './graphics';
import { World } from './world';

export * from './components';
export * from './error';
export * from './geometry';
export * from './graphics';
export * from './world';

export type BootstrapOptions = {
  /**
   * If true, the engine will bind the `app` and `world` instances to the
   * `window` object so they may be accessed via the browser console.
   */
  readonly bindToWindow?: boolean;

  /**
   * Options to pass to the PIXI application instance.
   */
  readonly renderOptions?: Partial<ApplicationOptions>;
};

/**
 * Bootstraps the engine and mounts the game graphics to the given HTML element.
 * Exposes the created engine and third party components (e.g. the PIXI
 * application instance).
 *
 * - Creates a new PIXI application instance.
 * - Creates a new world instance with a `Scene` component setup.
 */
export async function bootstrap({
  bindToWindow = false,
  renderOptions = {},
}: BootstrapOptions = {}) {
  const app = new Application();

  await app.init(renderOptions);

  if (typeof document !== 'undefined') {
    document.body.appendChild(app.canvas);
  }

  const world = new World({
    components: (world) => ({
      scene: () => new Scene(world, app),
    }),
  });

  app.ticker.add(() => world.update());

  if (typeof window !== 'undefined' && bindToWindow) {
    Object.assign(window, { app, world });
  }

  return {
    app,
    world,
  };
}
