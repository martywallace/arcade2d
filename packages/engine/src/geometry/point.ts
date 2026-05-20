import type { ImmutablePointPrimitive, PointPrimitive } from './point.types';

/**
 * Defines a point in 2D space. Provides functionality for common operations
 * between points and the parent space such as calculating distances and angles,
 * and performing vector operations.
 *
 * A `Point` also doubles as the engine's 2D vector type: methods like
 * {@link Point.length}, {@link Point.angle}, {@link Point.normalize},
 * {@link Point.dot} and {@link Point.cross} treat the point as a vector
 * measured from the origin `0,0`.
 *
 * The engine uses screen-space coordinates: `x` increases to the right and `y`
 * increases *downward*. This is why {@link Point.up} is `0,-1` and
 * {@link Point.down} is `0,1`.
 *
 * Mutating methods modify this point in place and return `this`, so calls can
 * be chained. Methods prefixed with `clone` never mutate this point.
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

  /**
   * Creates a new point from an existing point primitive or an `[x, y]` tuple.
   *
   * @param value The source to copy `x` and `y` from.
   */
  public static from(value: PointPrimitive | readonly [number, number]): Point {
    return 'x' in value
      ? new Point(value.x, value.y)
      : new Point(value[0], value[1]);
  }

  private _x: number;
  private _y: number;

  /**
   * Creates a new point. Any non-finite input (`NaN`, `Infinity`,
   * `-Infinity`) is rejected and replaced with `0`.
   *
   * @param initialX The initial x coordinate.
   * @param initialY The initial y coordinate.
   */
  constructor(initialX = 0, initialY = 0) {
    this._x = Number.isFinite(initialX) ? initialX : 0;
    this._y = Number.isFinite(initialY) ? initialY : 0;
  }

  /**
   * Returns a clone of this point. Useful for producing a new point with
   * displaced coordinates e.g.
   *
   * ```typescript
   * const newPosition = originalPosition.clone().moveTowards(target, 10);
   * ```
   */
  public clone(): Point {
    return new Point(this._x, this._y);
  }

  /**
   * Updates the coordinates of this point so the position is "snapped" to the
   * nearest cell corner in an abstract grid as defined by the input `x` and
   * `y` values. A spacing of `0` on an axis collapses that axis to `0`.
   *
   * @param x The x spacing between the grid columns.
   * @param y The y spacing between the grid rows.
   * @returns This point, for chaining.
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
   * Produces a new point with normalized `x` and `y` values (a unit vector
   * pointing in the same direction). Normalizing a zero-length point yields a
   * new `0,0` point.
   */
  public cloneToNormalized(): Point {
    const length = this.length;

    return length === 0
      ? new Point(0, 0)
      : new Point(this._x / length, this._y / length);
  }

  /**
   * Sets the coordinates of this point.
   *
   * @param x The new x value.
   * @param y The new y value.
   * @returns This point, for chaining.
   */
  public set(x: number, y: number): this {
    this.x = x;
    this.y = y;

    return this;
  }

  /**
   * Copies the coordinates from another point into this one.
   *
   * @param source The point to copy from.
   * @returns This point, for chaining.
   */
  public copyFrom(source: PointPrimitive): this {
    this.x = source.x;
    this.y = source.y;

    return this;
  }

  /**
   * Adds the input values to this point's coordinates.
   *
   * @param x The x value to add.
   * @param y The y value to add.
   * @returns This point, for chaining.
   */
  public add(x: number, y: number): this;
  /**
   * Adds another point's coordinates to this point's coordinates.
   *
   * @param point The point to add.
   * @returns This point, for chaining.
   */
  public add(point: PointPrimitive): this;
  public add(xOrPoint: number | PointPrimitive, y?: number): this {
    if (typeof xOrPoint === 'number') {
      this.x += xOrPoint;
      this.y += y ?? 0;
    } else {
      this.x += xOrPoint.x;
      this.y += xOrPoint.y;
    }

    return this;
  }

  /**
   * Subtracts the input values from this point's coordinates.
   *
   * @param x The x value to subtract.
   * @param y The y value to subtract.
   * @returns This point, for chaining.
   */
  public subtract(x: number, y: number): this;
  /**
   * Subtracts another point's coordinates from this point's coordinates.
   *
   * @param point The point to subtract.
   * @returns This point, for chaining.
   */
  public subtract(point: PointPrimitive): this;
  public subtract(xOrPoint: number | PointPrimitive, y?: number): this {
    if (typeof xOrPoint === 'number') {
      this.x -= xOrPoint;
      this.y -= y ?? 0;
    } else {
      this.x -= xOrPoint.x;
      this.y -= xOrPoint.y;
    }

    return this;
  }

  /**
   * Scales this point's coordinates by the given factors. A single argument
   * scales both axes uniformly.
   *
   * @param x The factor to scale x by.
   * @param y The factor to scale y by. Defaults to `x`.
   * @returns This point, for chaining.
   */
  public scale(x: number, y = x): this {
    this.x *= x;
    this.y *= y;

    return this;
  }

  /**
   * Negates this point's coordinates, producing the opposing vector.
   *
   * @returns This point, for chaining.
   */
  public negate(): this {
    this.x = -this._x;
    this.y = -this._y;

    return this;
  }

  /**
   * Normalizes this point in place so it becomes a unit vector pointing in the
   * same direction. Normalizing a zero-length point leaves it at `0,0`.
   *
   * @returns This point, for chaining.
   */
  public normalize(): this {
    const length = this.length;

    if (length !== 0) {
      this.x = this._x / length;
      this.y = this._y / length;
    }

    return this;
  }

  /**
   * Rotates this point around an origin by the given angle.
   *
   * @param radians The angle to rotate by, measured in radians.
   * @param origin The pivot to rotate around. Defaults to `0,0`.
   * @returns This point, for chaining.
   */
  public rotate(radians: number, origin?: PointPrimitive): this {
    const ox = origin?.x ?? 0;
    const oy = origin?.y ?? 0;
    const dx = this._x - ox;
    const dy = this._y - oy;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    this.x = ox + dx * cos - dy * sin;
    this.y = oy + dx * sin + dy * cos;

    return this;
  }

  /**
   * Linearly interpolates this point toward a target point by a fraction `t`,
   * where `0` leaves this point unchanged and `1` moves it onto the target.
   * Values outside `0..1` extrapolate.
   *
   * @param target The target point.
   * @param t The interpolation fraction.
   * @returns This point, for chaining.
   */
  public lerp(target: PointPrimitive, t: number): this {
    this.x += (target.x - this._x) * t;
    this.y += (target.y - this._y) * t;

    return this;
  }

  /**
   * Move this point toward a target point by a given distance. The point will
   * not overshoot: if the target is nearer than `distance`, this point lands
   * exactly on the target.
   *
   * @param target The target point.
   * @param distance The distance toward the point to move.
   * @returns This point, for chaining.
   */
  public moveTowards(target: PointPrimitive, distance: number): this {
    const remaining = this.distanceTo(target);

    if (distance >= remaining) {
      return this.set(target.x, target.y);
    }

    const angle = this.angleTo(target);

    this.x += Math.cos(angle) * distance;
    this.y += Math.sin(angle) * distance;

    return this;
  }

  /**
   * Move this point forward by a given distance along {@link Point.angle} —
   * i.e. along the ray from the origin `0,0` through this point, treating the
   * point as a vector.
   *
   * @param distance The distance to move forward.
   * @returns This point, for chaining.
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
   * @returns This point, for chaining.
   */
  public moveInDirection(angle: number, distance: number): this {
    this.x += Math.cos(angle) * distance;
    this.y += Math.sin(angle) * distance;

    return this;
  }

  /**
   * Determines if this point is equal to a target point within a given
   * precision. The comparison is per-axis (Chebyshev): the point is considered
   * equal when *both* the x and y differences are within `precision`, rather
   * than comparing Euclidean distance.
   *
   * Note the default `precision` of `1` is deliberately loose — suited to
   * coarse "close enough" gameplay checks. Pass `0` for an exact comparison.
   *
   * @param target The target point.
   * @param precision The maximum allowed difference on each axis between this
   * point and the target point.
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
   * Calculate the squared distance from this point to a target point. Cheaper
   * than {@link Point.distanceTo} (no square root) and sufficient when only
   * comparing distances.
   *
   * @param target The target point.
   */
  public distanceSquaredTo(target: PointPrimitive): number {
    return (this._x - target.x) ** 2 + (this._y - target.y) ** 2;
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
   * Calculate the dot product between this point and a target point, treating
   * both as vectors from the origin `0,0`.
   *
   * @param target The target point.
   */
  public dot(target: PointPrimitive): number {
    return this._x * target.x + this._y * target.y;
  }

  /**
   * Calculate the 2D cross product (the z-component of the 3D cross product)
   * between this point and a target point, treating both as vectors from the
   * origin `0,0`. The sign indicates winding direction.
   *
   * @param target The target point.
   */
  public cross(target: PointPrimitive): number {
    return this._x * target.y - this._y * target.x;
  }

  /**
   * Returns a string representation of this point.
   */
  public toString(): string {
    return `Point(${this._x.toFixed(2)}, ${this._y.toFixed(2)})`;
  }

  /**
   * The x coordinate of this point.
   */
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

  /**
   * The y coordinate of this point.
   */
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
   * Calculates the length (magnitude) of this point measured as a vector from
   * `0,0`.
   */
  public get length(): number {
    return Math.sqrt(this._x ** 2 + this._y ** 2);
  }

  /**
   * Calculates the squared length of this point measured from `0,0`. Cheaper
   * than {@link Point.length} (no square root) and sufficient when only
   * comparing magnitudes.
   */
  public get lengthSquared(): number {
    return this._x ** 2 + this._y ** 2;
  }

  /**
   * Calculates the angle of this point in radians, measured from `0,0` as
   * `atan2(y, x)`. The result is in the range `(-π, π]`.
   */
  public get angle(): number {
    return Math.atan2(this._y, this._x);
  }
}
