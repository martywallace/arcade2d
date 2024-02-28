import { Application, Container, DisplayObject } from 'pixi.js';
import { Component, World } from '../world';
import { Point } from '../geometry';

export class Scene extends Container implements Component<World> {
  constructor(
    public readonly owner: World,
    protected readonly app: Application,
  ) {
    super();
  }

  public onAdded(): void {
    this.app.stage.addChild(this as DisplayObject);
  }

  public onUpdate(): void {
    //
  }

  public onDestroy(): void {
    this.app.stage.removeChild(this as DisplayObject);
  }

  public getMousePosition(): Point {
    const base = this.app.renderer.plugins.interaction.pointer.global;

    return new Point(base.x, base.y);
  }
}
