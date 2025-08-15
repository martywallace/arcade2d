import { Graphics } from 'pixi.js';
import { Component } from '../components';
import { WorldObject } from '../world';
import { Scene } from './scene';

export class SimpleGraphics extends Graphics implements Component<WorldObject> {
  public static solidRectangle(
    host: WorldObject,
    width: number,
    height: number,
    fill = 0xffffff,
  ) {
    const graphics = new SimpleGraphics(host);

    return graphics.rect(-(width / 2), -(height / 2), width, height).fill(fill);
  }

  private readonly _scene: Scene;

  constructor(public readonly host: WorldObject) {
    super();

    this._scene = host.world.getComponentByType(Scene);
  }

  public onAdded(): void {
    this._scene.addChild(this);
  }

  public onUpdate(): void {
    this.x = this.host.position.x;
    this.y = this.host.position.y;
  }

  public onDestroy(): void {
    this._scene.removeChild(this);
  }
}
