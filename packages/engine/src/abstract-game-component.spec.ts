/**
 * @jest-environment jsdom
 */

import { AbstractGameComponent } from './abstract-game-component';
import { Game } from './game';

class TrackingComponent extends AbstractGameComponent {
  public addedCount = 0;
  public updateCount = 0;
  public destroyCount = 0;

  public override onAdded(): void {
    this.addedCount += 1;
  }

  public override onUpdate(): void {
    this.updateCount += 1;
  }

  public override onDestroy(): void {
    this.destroyCount += 1;
  }
}

describe('AbstractGameComponent', () => {
  test('exposes the host Game as both host and game', () => {
    const game = Game.createHeadless();
    const component = new TrackingComponent(game);

    expect(component.host).toBe(game);
    expect(component.game).toBe(game);
  });

  test('default no-op hooks do not throw when subclass omits them', () => {
    class Minimal extends AbstractGameComponent {}

    const game = Game.createHeadless();
    const component = new Minimal(game);

    // All three required hooks fall through to the base's no-ops.
    expect(() => component.onAdded({})).not.toThrow();
    expect(() => component.onUpdate(undefined as never, {})).not.toThrow();
    expect(() => component.onDestroy({})).not.toThrow();
  });

  test('subclass overrides fire through the host lifecycle', () => {
    const game = Game.createHeadless();
    const component = new TrackingComponent(game);

    game.addComponent('tracker', component);
    expect(component.addedCount).toBe(1);

    game.update();
    expect(component.updateCount).toBe(1);

    game.destroy();
    expect(component.destroyCount).toBe(1);
  });

  test('defaults enabled to true (inherited from AbstractComponent)', () => {
    const game = Game.createHeadless();
    const component = new TrackingComponent(game);

    expect(component.enabled).toBe(true);
  });
});
