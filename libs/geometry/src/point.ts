export interface PointLike {
  /**
   * The horizontal value of the point.
   */
  x: number;

  /**
   * The vertical value of the point.
   */
  y: number;
}

/**
 * Defines a point in 2D space.
 */
export class Point implements PointLike {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  /**
   * Calculate the distance from this point to a target point.
   *
   * @param target The target point.
   */
  public distanceTo(target: PointLike): number {
    return Math.sqrt((this.x - target.x) ** 2 + (this.y - target.y) ** 2);
  }

  /**
   * Calculate the angle from this point to a target point.
   *
   * @param target The target point.
   */
  public angleTo(target: PointLike): number {
    return Math.atan2(target.y - this.y, target.x - this.x);
  }

  /**
   * Calculates the length of this point measured from 0,0.
   */
  public get length(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  /**
   * Calculates the angle of this point measured from 0,0.
   */
  public get angle(): number {
    return Math.atan2(this.y, this.x);
  }
}
