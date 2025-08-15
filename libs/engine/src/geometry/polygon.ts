import { ImmutablePointPrimitive, PointPrimitive } from './point';

/**
 * Defines a polygon in 2D space.
 *
 * @template TPointTuple - The tuple type of points that make up the polygon.
 */
export class Polygon<
  TPointTuple extends readonly PointPrimitive[] = readonly PointPrimitive[],
> {
  constructor(public readonly points: TPointTuple) {}

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
export class Rectangle extends Polygon<
  [PointPrimitive, PointPrimitive, PointPrimitive, PointPrimitive]
> {
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
