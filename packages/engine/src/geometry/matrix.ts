import type { DecomposedTransform } from './matrix.types';
import { Point } from './point';
import type { PointPrimitive } from './point.types';

/**
 * A 2D affine transform — the engine's representation of a fully-resolved
 * **world transform**. Where a {@link WorldObject} stores its transform as a
 * human-friendly decomposed triple (position, rotation, scale), a `Matrix`
 * is the composed form those three collapse into, and it is the *only* form
 * that survives an object hierarchy intact.
 *
 * ### Why a matrix, and not just position/rotation/scale
 *
 * As long as everything is flat, "position + rotation + scale" is a perfect
 * description of where a thing is. The moment you nest one object under
 * another, that stops being true: a child's world transform is its parent's
 * world transform composed with its own local one, and once a rotation meets
 * a **non-uniform** scale somewhere up that chain, the result contains
 * *shear* — a skew that no single (rotation, scale) pair can represent. A
 * matrix represents it exactly. This is why {@link WorldObject.worldMatrix}
 * is a `Matrix` and not three numbers, and why graphics push the matrix
 * straight to the renderer rather than a decomposed transform.
 *
 * ### Representation
 *
 * The transform is stored as the six significant entries of a 3×3 affine
 * matrix, in the same `a, b, c, d, tx, ty` layout the underlying renderer
 * (PIXI) uses, so handing one to the renderer is a field-for-field copy:
 *
 * ```
 * | a  c  tx |     x' = a·x + c·y + tx
 * | b  d  ty |     y' = b·x + d·y + ty
 * | 0  0  1  |
 * ```
 *
 * `a`/`b`/`c`/`d` are the linear part (rotation + scale + shear); `tx`/`ty`
 * are the translation. The default-constructed matrix is the identity.
 *
 * ### Mutation style
 *
 * Like {@link Point}, the in-place operations ({@link Matrix.append},
 * {@link Matrix.invert}) mutate this matrix and return `this` for chaining,
 * while {@link Matrix.clone} and {@link Matrix.apply} never mutate. Compose a
 * fresh matrix with the static {@link Matrix.compose}; tear one back apart
 * with {@link Matrix.decompose}.
 *
 * @example
 * ```typescript
 * // The world transform of a child = parent's world × child's local.
 * const world = parent.worldMatrix.append(
 *   Matrix.compose(child.position, child.rotation, child.scale),
 * );
 *
 * // Project the child's local origin into world space.
 * const worldOrigin = world.apply({ x: 0, y: 0 });
 * ```
 */
export class Matrix {
  /**
   * Creates a fresh identity matrix — the transform that leaves every point
   * unchanged. Equivalent to `new Matrix()`, but reads as intent at a call
   * site that needs a neutral starting transform.
   */
  public static identity(): Matrix {
    return new Matrix();
  }

  /**
   * Composes a translate → rotate → scale chain into a single matrix, in
   * that application order: a point is first scaled, then rotated, then
   * translated. This is the exact transform a {@link WorldObject} applies to
   * map a point from its own local space into its parent's space, so it is
   * the building block {@link WorldObject.worldMatrix} is assembled from.
   *
   * @param position The translation, applied last. Any {@link PointPrimitive}.
   * @param rotation The rotation in radians, measured clockwise from the
   * positive x-axis (matching {@link WorldObject.rotation}).
   * @param scale The per-axis scale, applied first. Any {@link PointPrimitive}.
   * @returns A new {@link Matrix} representing the composed transform.
   */
  public static compose(
    position: PointPrimitive,
    rotation: number,
    scale: PointPrimitive,
  ): Matrix {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return new Matrix(
      cos * scale.x,
      sin * scale.x,
      -sin * scale.y,
      cos * scale.y,
      position.x,
      position.y,
    );
  }

  /**
   * Creates a new matrix from its six affine entries. Defaults to the
   * identity matrix.
   *
   * @param a Row-0 x-axis factor (cosine·scaleX for a pure TRS transform).
   * @param b Row-1 x-axis factor (sine·scaleX).
   * @param c Row-0 y-axis factor (−sine·scaleY).
   * @param d Row-1 y-axis factor (cosine·scaleY).
   * @param tx Translation along x.
   * @param ty Translation along y.
   */
  constructor(
    public a = 1,
    public b = 0,
    public c = 0,
    public d = 1,
    public tx = 0,
    public ty = 0,
  ) {}

  /**
   * Returns an independent copy of this matrix. Use before a mutating
   * operation ({@link Matrix.append}, {@link Matrix.invert}) when the
   * original must be preserved.
   */
  public clone(): Matrix {
    return new Matrix(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }

  /**
   * Post-multiplies this matrix by `other` in place — `this = this × other`
   * — and returns `this`. "Post-multiply" means `other` is applied to a
   * point *first*: `this.append(other).apply(p)` equals
   * `this.apply(other.apply(p))`.
   *
   * This is the operation that walks an object hierarchy: starting from a
   * parent's world matrix and appending a child's local matrix yields the
   * child's world matrix.
   *
   * @param other The matrix to apply before this one.
   * @returns This matrix, for chaining.
   */
  public append(other: Matrix): this {
    const { a, b, c, d, tx, ty } = this;

    this.a = a * other.a + c * other.b;
    this.b = b * other.a + d * other.b;
    this.c = a * other.c + c * other.d;
    this.d = b * other.c + d * other.d;
    this.tx = a * other.tx + c * other.ty + tx;
    this.ty = b * other.tx + d * other.ty + ty;

    return this;
  }

  /**
   * Inverts this matrix in place and returns `this`, so that applying the
   * result undoes the original transform. Used when reparenting an object
   * "in place": the new local transform is the new parent's inverse world
   * matrix appended with the object's current world matrix.
   *
   * A matrix with a zero determinant (one that collapses space — e.g. a
   * zero scale on an axis) has no inverse; rather than producing
   * `Infinity`/`NaN` entries, this resets the matrix to the identity. The
   * collapse is already information-losing, so identity is the least
   * surprising degenerate result.
   *
   * @returns This matrix, for chaining.
   */
  public invert(): this {
    const { a, b, c, d, tx, ty } = this;
    const determinant = a * d - b * c;

    if (determinant === 0) {
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.d = 1;
      this.tx = 0;
      this.ty = 0;

      return this;
    }

    const inverseDeterminant = 1 / determinant;

    this.a = d * inverseDeterminant;
    this.b = -b * inverseDeterminant;
    this.c = -c * inverseDeterminant;
    this.d = a * inverseDeterminant;
    this.tx = (c * ty - d * tx) * inverseDeterminant;
    this.ty = (b * tx - a * ty) * inverseDeterminant;

    return this;
  }

  /**
   * Transforms a point by this matrix, returning the result as a fresh
   * {@link Point} (this matrix and the input are left untouched). Equivalent
   * to `(a·x + c·y + tx, b·x + d·y + ty)`.
   *
   * @param point The point to transform. Any {@link PointPrimitive}.
   * @returns A new {@link Point} holding the transformed coordinates.
   */
  public apply(point: PointPrimitive): Point {
    return new Point(
      this.a * point.x + this.c * point.y + this.tx,
      this.b * point.x + this.d * point.y + this.ty,
    );
  }

  /**
   * Recovers an approximate translate/rotate/scale triple from this matrix —
   * the lossy inverse of {@link Matrix.compose}. Round-trips exactly for any
   * matrix built from a TRS chain with non-negative scale; a matrix carrying
   * shear (rotation composed with non-uniform scale, as can happen deep in
   * an object hierarchy) is approximated, because shear has no TRS
   * representation.
   *
   * Translation is read directly from `tx`/`ty`; the x-scale and y-scale are
   * the lengths of the two basis vectors; rotation is the angle of the first
   * basis vector. See {@link DecomposedTransform} for the per-field contract.
   *
   * @returns The recovered {@link DecomposedTransform}.
   */
  public decompose(): DecomposedTransform {
    return {
      x: this.tx,
      y: this.ty,
      rotation: Math.atan2(this.b, this.a),
      scaleX: Math.hypot(this.a, this.b),
      scaleY: Math.hypot(this.c, this.d),
    };
  }
}
