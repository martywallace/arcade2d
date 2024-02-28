import { ImmutablePointPrimitive } from './point';

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

/**
 * Defines a rectangle in 2D space.
 */
export class Rectangle extends Polygon {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly width: number,
    public readonly height: number,
  ) {
    super([
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ]);
  }

  public get topLeft(): ImmutablePointPrimitive {
    return this.points[0];
  }

  public get topRight(): ImmutablePointPrimitive {
    return this.points[1];
  }

  public get bottomRight(): ImmutablePointPrimitive {
    return this.points[2];
  }

  public get bottomLeft(): ImmutablePointPrimitive {
    return this.points[3];
  }
}
