import { Scene } from './scene';
import { DisplayObject, Graphics } from 'pixi.js';
import { Component, WorldObject } from '../world';

export class SimpleGraphics extends Graphics implements Component<WorldObject> {
  private readonly _scene: Scene;

  constructor(public readonly owner: WorldObject) {
    super();

    this._scene = owner.world.getComponentByType(Scene);
  }

  public onAdded(): void {
    this._scene.addChild(this as DisplayObject);
  }

  public onUpdate(): void {
    this.x = this.owner.position.x;
    this.y = this.owner.position.y;
  }

  public onDestroy(): void {
    this._scene.removeChild(this as DisplayObject);
  }
}
