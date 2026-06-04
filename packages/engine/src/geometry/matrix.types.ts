/**
 * The translation/rotation/scale factors recovered from a {@link Matrix} by
 * {@link Matrix.decompose}. This is the lossy inverse of
 * {@link Matrix.compose}: it round-trips cleanly for any matrix that was
 * built from a translate → rotate → scale chain, but a matrix carrying
 * **shear** (which arises when a rotation is composed with a non-uniform
 * scale up an object hierarchy) cannot be expressed as a single TRS triple,
 * so the recovered factors are a best-effort approximation in that case.
 *
 * @see {@link Matrix.decompose} for the recovery rules and their limits.
 */
export type DecomposedTransform = {
  /**
   * The translation along the x-axis — equal to the matrix's `tx`.
   */
  readonly x: number;

  /**
   * The translation along the y-axis — equal to the matrix's `ty`.
   */
  readonly y: number;

  /**
   * The rotation in radians, measured clockwise from the positive x-axis to
   * match {@link WorldObject.rotation}. Recovered from the orientation of the
   * matrix's first basis vector, so it is only meaningful for non-negative,
   * shear-free scales.
   */
  readonly rotation: number;

  /**
   * The scale factor along the local x-axis — the length of the matrix's
   * first basis vector. Always non-negative; a mirrored (negative-scale)
   * matrix decomposes to a positive scale plus a half-turn of rotation
   * rather than a signed factor.
   */
  readonly scaleX: number;

  /**
   * The scale factor along the local y-axis — the length of the matrix's
   * second basis vector. Always non-negative; see {@link scaleX}.
   */
  readonly scaleY: number;
};
