import { Polygon } from './polygon';
import { ImmutablePointPrimitive } from './point';

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
