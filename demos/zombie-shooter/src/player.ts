import {
  Component,
  Scene,
  SimpleGraphics,
  WorldObject,
} from '@arcade2d/engine';

export class PlayerController implements Component<WorldObject> {
  constructor(public readonly owner: WorldObject) {}

  public onAdded(): void {}

  public onUpdate(): void {
    const mouse = this.owner.world.getComponentByType(Scene).getMousePosition();
    const angle = this.owner.position.angleTo(mouse);

    this.owner.position.x += Math.cos(angle) * 2;
    this.owner.position.y += Math.sin(angle) * 2;

    this.owner.getComponent<SimpleGraphics>('graphics').rotation += 0.02;
  }

  public onDestroy(): void {}
}
