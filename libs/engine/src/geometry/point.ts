export interface PointPrimitive {
  /**
   * The horizontal value of the point.
   */
  x: number;

  /**
   * The vertical value of the point.
   */
  y: number;
}

export interface ImmutablePointPrimitive extends Readonly<PointPrimitive> {}

/**
 * Defines a point in 2D space. Provides functionality for common operations
 * between points and the parent space such as calculating distances and angles,
 * and performing vector operations.
 */
export class Point implements PointPrimitive {
  /**
   * Creates a new point of `0,0`.
   */
  public static zero(): Point {
    return new Point(0, 0);
  }

  /**
   * Creates a new point of `0,-1`, representing an "upward facing" magnitude.
   */
  public static up(): Point {
    return new Point(0, -1);
  }

  /**
   * Creates a new point of `0,1`, representing a "downward facing" magnitude.
   */
  public static down(): Point {
    return new Point(0, 1);
  }

  /**
   * Creates a new point of `-1,0`, representing a "left facing" magnitude.
   */
  public static left(): Point {
    return new Point(-1, 0);
  }

  /**
   * Creates a new point of `1,0`, representing a "right facing" magnitude.
   */
  public static right(): Point {
    return new Point(1, 0);
  }

  /**
   * Creates a new point where the `x` and `y` values indicate a direction
   * specified by input radians, starting from `1,0`.
   *
   * @param radians The angle in radians.
   */
  public static angular(radians: number): Point {
    return new Point(Math.cos(radians), Math.sin(radians));
  }

  private _x: number;
  private _y: number;

  constructor(initialX = 0, initialY = 0) {
    this._x = Number.isFinite(initialX) ? initialX : 0;
    this._y = Number.isFinite(initialY) ? initialY : 0;
  }

  /**
   * Returns a clone of this point. Useful for producing a new point with
   * displaced coordinates e.g.
   *
   * ```typescript
   * const newPosition = originalPosition.clone().moveToward(target, 10);
   * ```
   */
  public clone(): Point {
    return new Point(this._x, this._y);
  }

  /**
   * Updates the coordinates of this point so the position is "snapped" to the
   * nearest cell corner in an abstract grid as defined by the input `x` and
   * `y` values.
   *
   * @param x The x spacing between the grid columns.
   * @param y The y spacing between the grid rows.
   */
  public snap(x = 1, y = 1): this {
    this.x = x === 0 ? 0 : Math.round(this._x / x) * x;
    this.y = y === 0 ? 0 : Math.round(this._y / y) * y;

    return this;
  }

  /**
   * Returns a primitive clone of this point.
   */
  public cloneToPrimitive(): PointPrimitive {
    return { x: this._x, y: this._y };
  }

  /**
   * Returns an immutable primitive clone of this point, where the `x` and `y`
   * values are frozen at runtime and marked readonly by the compiler.
   */
  public cloneToImmutablePrimitive(): ImmutablePointPrimitive {
    return Object.freeze({ x: this._x, y: this._y });
  }

  /**
   * Returns a tuple clone of this point expressed as `[x, y]`.
   */
  public cloneToTuple(): [number, number] {
    return [this._x, this._y];
  }

  /**
   * Produce a new point with normalized x and y values.
   */
  public cloneToNormalized(): Point {
    return new Point(this._x / this.length, this._y / this.length);
  }

  /**
   * Adds the input values to this point's coordinates.
   *
   * @param x The x value to add.
   * @param y The y value to add.
   */
  public add(x: number, y: number): this {
    this.x += x;
    this.y += y;

    return this;
  }

  /**
   * Move this point toward a target point by a given distance.
   *
   * @param target The target point.
   * @param distance The distance toward the point to move.
   */
  public moveTowards(target: PointPrimitive, distance: number): this {
    const angle = this.angleTo(target);

    this.x += Math.cos(angle) * distance;
    this.y += Math.sin(angle) * distance;

    return this;
  }

  /**
   * Move this point forward along its current angle by a given distance.
   *
   * @param distance The distance to move forward.
   */
  public forward(distance: number): this {
    return this.add(
      Math.cos(this.angle) * distance,
      Math.sin(this.angle) * distance,
    );
  }

  /**
   * Move this point in a given direction by a given distance.
   *
   * @param angle The angle to move in, measured in radians.
   * @param distance The distance to move in the given direction.
   */
  public moveInDirection(angle: number, distance: number): this {
    this.x += Math.cos(angle) * distance;
    this.y += Math.sin(angle) * distance;

    return this;
  }

  /**
   * Determines if this point is equal to a target point with a given precision.
   *
   * @param target The target point.
   * @param precision The maximum difference in value between the x or y values
   * of this point and the target point.
   */
  public equals(target: PointPrimitive, precision = 1): boolean {
    return (
      Math.abs(this._x - target.x) <= precision &&
      Math.abs(this._y - target.y) <= precision
    );
  }

  /**
   * Calculate the distance from this point to a target point.
   *
   * @param target The target point.
   */
  public distanceTo(target: PointPrimitive): number {
    return Math.sqrt((this._x - target.x) ** 2 + (this._y - target.y) ** 2);
  }

  /**
   * Calculate the angle from this point to a target point.
   *
   * @param target The target point.
   */
  public angleTo(target: PointPrimitive): number {
    return Math.atan2(target.y - this._y, target.x - this._x);
  }

  /**
   * Returns a string representation of this point.
   */
  public toString(): string {
    return `Point(${this._x.toFixed(2)}, ${this._y.toFixed(2)})`;
  }

  public get x(): number {
    return this._x;
  }

  /**
   * Sets the x coordinate of this point. If the input value is not a finite
   * value, the current value is preserved.
   */
  public set x(value: number) {
    this._x = Number.isFinite(value) ? value : this._x;
  }

  public get y(): number {
    return this._y;
  }

  /**
   * Sets the y coordinate of this point. If the input value is not a finite
   * value, the current value is preserved.
   */
  public set y(value: number) {
    this._y = Number.isFinite(value) ? value : this._y;
  }

  /**
   * Calculates the length of this point measured from 0,0.
   */
  public get length(): number {
    return Math.sqrt(this._x ** 2 + this._y ** 2);
  }

  /**
   * Calculates the angle of this point measured from 0,0.
   */
  public get angle(): number {
    return Math.atan2(this._y, this._x);
  }
}
