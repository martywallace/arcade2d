/**
 * Defines a point in 2D space.
 */
export class Point {
  constructor(
    /**
     * The horizontal value of the point.
     */
    public x = 0,
    /**
     * The vertical value of the point.
     */
    public y = 0,
  ) {}

  /**
   * Calculates the length of this point measured from 0,0.
   */
  public length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
}
