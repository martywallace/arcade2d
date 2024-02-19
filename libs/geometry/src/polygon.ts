import { ImmutablePointPrimitive } from './point';
import { Rectangle } from './rectangle';

/**
 * Defines a polygon in 2D space.
 */
export class Polygon {
  constructor(public readonly points: readonly ImmutablePointPrimitive[]) {}

  public getBoundingBox(): Rectangle {
    const xs = this.points.map((point) => point.x);
    const ys = this.points.map((point) => point.y);

    const x = Math.min(...xs);
    const y = Math.min(...ys);

    return new Rectangle(x, y, Math.max(...xs) - x, Math.max(...ys) - y);
  }

  public getCenter(): ImmutablePointPrimitive {
    const bb = this.getBoundingBox();

    return {
      x: bb.x + bb.width / 2,
      y: bb.y + bb.height / 2,
    };
  }
}
