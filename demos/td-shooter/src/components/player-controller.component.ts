import type { Component } from '@arcade2d/engine';
import { Scene, SimpleGraphics, WorldObject } from '@arcade2d/engine';

export class PlayerController implements Component<WorldObject> {
  constructor(public readonly host: WorldObject) {}

  public onAdded(): void {
    console.log(`Added player controller to ${this.host.metadata.id}`);
  }

  public onUpdate(): void {
    const mouse = this.host.world.getComponentByType(Scene).getMousePosition();

    this.host.position.moveTowards(mouse, 1.5);

    this.host.getComponentByType(SimpleGraphics).rotation += 0.02;

    if (this.host.position.y > 500) {
      this.host.destroy();
    }
  }

  public onDestroy(): void {}
}
