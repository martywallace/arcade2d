import { AbstractWorldComponent } from '@arcade2d/engine';
import { createBall } from './objects/ball';
import { createBox } from './objects/box';

/**
 * A world-scoped component that drops a fresh body wherever the user clicks.
 *
 * It samples the world-space mouse each frame and edge-detects the left
 * button — spawning exactly one box or ball on the press, not once per frame
 * the button is held — demonstrating that bodies can be created at runtime
 * mid-simulation, not just during setup.
 */
export class Spawner extends AbstractWorldComponent {
  private _wasDown = false;

  public override onUpdate(): void {
    const { position, buttons } = this.world.getMouseState();

    if (buttons.left && !this._wasDown) {
      const spawn = Math.random() < 0.5 ? createBox : createBall;
      spawn(this.world, position);
    }

    this._wasDown = buttons.left;
  }
}
