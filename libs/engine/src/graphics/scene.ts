import { Application, Container } from 'pixi.js';
import { Point } from '../geometry';
import { Component, World } from '../world';

export class Scene extends Container implements Component<World> {
  constructor(
    public readonly host: World,
    protected readonly app: Application,
  ) {
    super();
  }

  public onAdded(): void {
    this.app.stage.addChild(this);
  }

  public onUpdate(): void {
    //
  }

  public onDestroy(): void {
    this.app.stage.removeChild(this);
  }

  public getMousePosition(): Point {
    const base = this.app.renderer.events.pointer.global;

    return new Point(base.x, base.y);
  }
}
