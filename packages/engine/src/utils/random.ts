import { ErrorCode } from '../error.constants';
import { throwEngineError } from '../error.support';
import type {
  ImmutablePointPrimitive,
  PointPrimitive,
} from '../geometry/point.types';
import { Polygon } from '../geometry/polygon';
import type { RandomOptions } from './random.types';

const TWO_PI = Math.PI * 2;
const UINT32 = 0x100000000;
const HEX_DIGITS = '0123456789abcdef';
const MAX_REJECTION_ATTEMPTS = 1024;

/**
 * Hashes a string into a deterministic 32-bit unsigned integer using a
 * cyrb53-derived mixer. Distinct strings reliably produce distinct seeds; the
 * same string always produces the same seed.
 */
function hashStringToSeed(value: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h1 ^ h2) >>> 0;
}

function normaliseSeed(seed: number | string | undefined): number {
  if (typeof seed === 'string') {
    return hashStringToSeed(seed);
  }

  if (typeof seed === 'number' && Number.isFinite(seed)) {
    // Coerce to a 32-bit unsigned integer; this keeps the state in the range
    // mulberry32 expects, and means `new Random({ seed: 0.5 })` does the same
    // thing as `new Random({ seed: 0 })` rather than silently producing a
    // different stream than `new Random({ seed: 0 })` on a second run.
    return Math.floor(seed) >>> 0;
  }

  // Time-based fallback. Mixed with Math.random so two `new Random()` calls in
  // the same millisecond still diverge.
  return ((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * UINT32)) >>> 0;
}

/**
 * A seedable pseudo-random number generator and a grab-bag of common
 * game-development helpers built on top of it.
 *
 * `Random` is a thin, dependency-free wrapper around
 * [mulberry32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32),
 * a small, fast 32-bit PRNG with a 2³² period — more than adequate for
 * gameplay use (particle jitter, loot rolls, spawn placement, deterministic
 * replays, etc.). It is **not** cryptographically secure; do not use it where
 * an attacker controls or observes outputs.
 *
 * ## Seeding
 *
 * Construct with `new Random(options)`. Passing no `seed` produces a
 * time-based seed; passing a `seed` (number or string) produces a fully
 * deterministic stream — two generators built with the same seed emit the
 * same sequence forever. String seeds are hashed so named seeds like
 * `'daily-2026-05-20'` work as expected.
 *
 * ## Determinism and persistence
 *
 * Use {@link Random.getState} / {@link Random.setState} (or
 * `new Random({ state })`) to snapshot and restore the exact internal state.
 * This is what powers deterministic replays — capture the state at the start
 * of a frame, capture the inputs, and re-running both reproduces the frame
 * exactly.
 *
 * ## Sampling helpers
 *
 * The sampling helpers ({@link Random.inRectangle}, {@link Random.inCircle},
 * {@link Random.inRing}, {@link Random.inPolygon}) return frozen
 * {@link PointPrimitive}s in **absolute** coordinates — pass the world-space
 * center or origin of the area you want to sample within. They produce
 * uniformly distributed points (not biased toward the center, which a naive
 * polar sampler would do).
 *
 * @example
 * ```typescript
 * const rng = new Random({ seed: 'level-3' });
 *
 * rng.between(0, 10);              // float in [0, 10)
 * rng.integer(1, 6);               // integer in [1, 6] inclusive (a d6 roll)
 * rng.boolean(0.25);               // 25% chance of true
 * rng.pick(['rock', 'paper']);     // one of the items, uniformly
 * rng.inCircle(100, 100, 50);      // uniform point in a 50-radius disc
 * rng.color();                     // random 24-bit color
 * ```
 *
 * @example Determinism via state snapshots:
 * ```typescript
 * const a = new Random({ seed: 42 });
 * a.next(); a.next();
 *
 * const b = new Random({ state: a.getState() });
 * b.next() === a.next(); // true — same state, same next value
 * ```
 */
export class Random {
  /**
   * The 32-bit unsigned integer seed this generator was constructed with.
   * Stable for the lifetime of the instance — even after the internal state
   * has advanced — so it can be logged or echoed back in a save file to
   * reproduce a run.
   *
   * When the generator was constructed with `state` rather than `seed`, the
   * `seed` is the value of that initial state.
   */
  public readonly seed: number;

  private _state: number;

  /**
   * Creates a new generator.
   *
   * @param options Seed and/or state. With no arguments, the seed is derived
   * from the current time mixed with `Math.random`, so two unseeded
   * generators are extremely unlikely to produce the same stream.
   */
  constructor(options: RandomOptions = {}) {
    const seed =
      options.state !== undefined && Number.isFinite(options.state)
        ? Math.floor(options.state) >>> 0
        : normaliseSeed(options.seed);

    this.seed = seed;
    this._state = seed;
  }

  /**
   * Advances the generator and returns a uniformly distributed float in the
   * range `[0, 1)`. This is the raw output of the underlying PRNG; every
   * other helper on `Random` is built on top of it.
   */
  public next(): number {
    return this._next32() / UINT32;
  }

  /**
   * Returns a uniformly distributed float in the range `[min, max)`. If
   * `min` is greater than `max` the arguments are swapped, so the caller
   * does not need to pre-sort them. When `min === max` the result is exactly
   * `min`.
   *
   * @param min The lower bound (inclusive).
   * @param max The upper bound (exclusive).
   */
  public between(min: number, max: number): number {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);

    return lo + this.next() * (hi - lo);
  }

  /**
   * Returns a uniformly distributed integer in the range `[min, max]`, both
   * ends inclusive — the conventional "roll a d6" semantics. Non-integer
   * bounds are floored toward zero; if `min` is greater than `max` the
   * arguments are swapped.
   *
   * @param min The lower bound (inclusive).
   * @param max The upper bound (inclusive).
   */
  public integer(min: number, max: number): number {
    const lo = Math.min(Math.floor(min), Math.floor(max));
    const hi = Math.max(Math.floor(min), Math.floor(max));

    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /**
   * Returns `true` with the given probability, `false` otherwise. The default
   * probability of `0.5` makes the call read as a fair coin flip.
   *
   * Probabilities `<= 0` always return `false`; probabilities `>= 1` always
   * return `true`. The PRNG is still advanced in those cases, keeping the
   * stream deterministic regardless of the threshold.
   *
   * @param probability The probability of returning `true`, between `0` and
   * `1`.
   */
  public boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Returns either `-1` or `1` with equal probability. Useful for randomising
   * a velocity direction or flipping a sprite.
   */
  public sign(): -1 | 1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  /**
   * Returns a uniformly distributed angle in radians, in the range `[0, 2π)`.
   * Pair with {@link Math.cos} / {@link Math.sin} for a random unit vector.
   */
  public angle(): number {
    return this.next() * TWO_PI;
  }

  /**
   * Picks one element from `items` uniformly at random.
   *
   * @param items The collection to pick from. Must contain at least one
   * element.
   * @returns The chosen element.
   * @throws An {@link EngineError} with code
   * {@link ErrorCode.RANDOM_EMPTY_ITEMS} when `items` is empty — picking from
   * nothing is always a programming error.
   */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throwEngineError(
        ErrorCode.RANDOM_EMPTY_ITEMS,
        'Random.pick called on an empty collection.',
      );
    }

    // Length-checked above; the non-null assertion is safe under
    // noUncheckedIndexedAccess.
    return items[this.integer(0, items.length - 1)]!;
  }

  /**
   * Shuffles `items` in place using a Fisher–Yates pass and returns the same
   * array, so the call can be chained or its result captured inline. An
   * empty or single-element array is returned untouched.
   *
   * @param items The array to shuffle. Mutated in place.
   * @returns The same array reference, now shuffled.
   */
  public shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.integer(0, i);
      const tmp = items[i]!;
      items[i] = items[j]!;
      items[j] = tmp;
    }

    return items;
  }

  /**
   * Returns a frozen point uniformly distributed within the axis-aligned
   * rectangle described by the given origin and size. The origin is the
   * rectangle's top-left corner in screen-space (`y` increases downward).
   *
   * Negative `width` or `height` are treated as their absolute value, with
   * the origin still the top-left corner of the resulting box.
   *
   * @param x The x coordinate of the rectangle's left edge.
   * @param y The y coordinate of the rectangle's top edge.
   * @param width The width of the rectangle.
   * @param height The height of the rectangle.
   */
  public inRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
  ): ImmutablePointPrimitive {
    const w = Math.abs(width);
    const h = Math.abs(height);

    return Object.freeze({
      x: x + this.next() * w,
      y: y + this.next() * h,
    });
  }

  /**
   * Returns a frozen point uniformly distributed within the closed disc
   * centred at `(x, y)` with the given radius. Uses the
   * `r = R * sqrt(u)` mapping to avoid the bias toward the center that a
   * naive `(r, θ)` sampler produces.
   *
   * A `radius` of `0` (or negative, which is treated as its absolute value)
   * returns the center point.
   *
   * @param x The x coordinate of the circle's center.
   * @param y The y coordinate of the circle's center.
   * @param radius The radius of the circle.
   */
  public inCircle(
    x: number,
    y: number,
    radius: number,
  ): ImmutablePointPrimitive {
    const r = Math.abs(radius) * Math.sqrt(this.next());
    const theta = this.next() * TWO_PI;

    return Object.freeze({
      x: x + Math.cos(theta) * r,
      y: y + Math.sin(theta) * r,
    });
  }

  /**
   * Returns a frozen point uniformly distributed within the rectangular
   * **frame** described by an outer rectangle of `width × height` anchored at
   * `(x, y)` (its top-left, screen-space) and a uniform inset `thickness`.
   * This is the rectangle analog of {@link Random.inRing}: sampling lands
   * anywhere in the band between the outer rectangle and the inner rectangle
   * carved out by the inset, never inside the inner hole.
   *
   * Sampling is exact (not rejection-based): the four border strips are
   * weighted by area and one is picked, then the point is drawn uniformly
   * within it. Cost is constant regardless of how thin the frame is.
   *
   * Edge cases:
   * - When `thickness * 2 >= min(width, height)` the frame fills the entire
   *   outer rectangle (no interior hole left), and the result is equivalent
   *   to {@link Random.inRectangle}.
   * - When `thickness <= 0` the frame has zero area; the call returns the
   *   outer rectangle's top-left corner `(x, y)` without consuming a draw
   *   from the underlying PRNG.
   * - Negative `width` or `height` are treated as their absolute value, with
   *   `(x, y)` remaining the top-left corner of the resulting outer box.
   *
   * @param x The x coordinate of the outer rectangle's left edge.
   * @param y The y coordinate of the outer rectangle's top edge.
   * @param width The width of the outer rectangle.
   * @param height The height of the outer rectangle.
   * @param thickness The uniform inset that separates the outer rectangle
   * from the inner hole.
   */
  public inFrame(
    x: number,
    y: number,
    width: number,
    height: number,
    thickness: number,
  ): ImmutablePointPrimitive {
    const w = Math.abs(width);
    const h = Math.abs(height);
    const t = Math.max(0, Math.min(thickness, w / 2, h / 2));

    if (t * 2 >= w || t * 2 >= h) {
      return this.inRectangle(x, y, w, h);
    }

    // Partition the frame into four disjoint strips so sampling stays
    // uniform across the band. Top and bottom span the full width; the
    // left/right strips drop the corners (already covered by top/bottom).
    const topArea = w * t;
    const sideArea = (h - 2 * t) * t;
    const totalArea = 2 * topArea + 2 * sideArea;

    if (totalArea === 0) {
      return Object.freeze({ x, y });
    }

    const pick = this.next() * totalArea;

    if (pick < topArea) {
      return Object.freeze({
        x: x + this.next() * w,
        y: y + this.next() * t,
      });
    }

    if (pick < topArea * 2) {
      return Object.freeze({
        x: x + this.next() * w,
        y: y + h - t + this.next() * t,
      });
    }

    if (pick < topArea * 2 + sideArea) {
      return Object.freeze({
        x: x + this.next() * t,
        y: y + t + this.next() * (h - 2 * t),
      });
    }

    return Object.freeze({
      x: x + w - t + this.next() * t,
      y: y + t + this.next() * (h - 2 * t),
    });
  }

  /**
   * Returns a frozen point uniformly distributed within the annulus (ring)
   * centred at `(x, y)`, bounded by `minRadius` and `maxRadius`. Uses the
   * `r = sqrt(u * (R² - r²) + r²)` mapping so points are uniform over the
   * ring's area, not its radius.
   *
   * If `minRadius` is greater than `maxRadius` the arguments are swapped.
   * Negative radii are treated as their absolute value.
   *
   * @param x The x coordinate of the ring's center.
   * @param y The y coordinate of the ring's center.
   * @param minRadius The inner radius (exclusive when `> 0`).
   * @param maxRadius The outer radius.
   */
  public inRing(
    x: number,
    y: number,
    minRadius: number,
    maxRadius: number,
  ): ImmutablePointPrimitive {
    const a = Math.abs(minRadius);
    const b = Math.abs(maxRadius);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const r = Math.sqrt(this.next() * (hi * hi - lo * lo) + lo * lo);
    const theta = this.next() * TWO_PI;

    return Object.freeze({
      x: x + Math.cos(theta) * r,
      y: y + Math.sin(theta) * r,
    });
  }

  /**
   * Returns a frozen point uniformly distributed inside the given simple
   * (non-self-intersecting) polygon, expressed by its vertices in absolute
   * coordinates. Uses bounding-box rejection sampling backed by
   * {@link Polygon.containsPoint}: simple and correct for any shape, but
   * cost grows with how much of the bounding box the polygon doesn't fill.
   *
   * For pathological inputs (a polygon with effectively zero area, or
   * extreme aspect ratio that defeats rejection sampling), the method gives
   * up after a bounded number of attempts and falls back to the polygon's
   * area centroid so callers still get a sensible point inside the shape.
   *
   * Polygons with fewer than three vertices are degenerate; the first
   * vertex (or `(0, 0)` for an empty array) is returned instead.
   *
   * @param vertices The polygon's vertices, in order, in absolute coords.
   */
  public inPolygon(
    vertices: readonly PointPrimitive[],
  ): ImmutablePointPrimitive {
    if (vertices.length < 3) {
      const first = vertices[0];

      return Object.freeze({ x: first?.x ?? 0, y: first?.y ?? 0 });
    }

    const polygon = new Polygon(vertices);
    const { min, max } = polygon.getBounds();
    const width = max.x - min.x;
    const height = max.y - min.y;

    if (width === 0 || height === 0) {
      const centroid = polygon.getCentroid();

      return Object.freeze({ x: centroid.x, y: centroid.y });
    }

    for (let i = 0; i < MAX_REJECTION_ATTEMPTS; i++) {
      const candidate = {
        x: min.x + this.next() * width,
        y: min.y + this.next() * height,
      };

      if (polygon.containsPoint(candidate)) {
        return Object.freeze(candidate);
      }
    }

    const centroid = polygon.getCentroid();

    return Object.freeze({ x: centroid.x, y: centroid.y });
  }

  /**
   * Returns a 24-bit color as a number in the range `[min, max]`, suitable
   * for passing to PIXI tinting / fill APIs. The default range covers the
   * full RGB space (`0x000000` to `0xffffff`).
   *
   * Bounds outside `[0x000000, 0xffffff]` are clamped, and a `min` greater
   * than `max` is swapped. Note this samples *integer* colors uniformly over
   * the numeric range — it does not perform any perceptually uniform sampling
   * in HSL/LAB space.
   *
   * @param min The lower bound color (inclusive).
   * @param max The upper bound color (inclusive).
   */
  public color(min = 0x000000, max = 0xffffff): number {
    const lo = Math.max(0x000000, Math.min(min, max));
    const hi = Math.min(0xffffff, Math.max(min, max));

    return this.integer(lo, hi);
  }

  /**
   * Returns a string of random lowercase hexadecimal characters of the given
   * length. Useful for ad-hoc ids, mock asset hashes, debug labels, and so
   * on. Each character is drawn independently from `0-9a-f`.
   *
   * Non-positive or non-integer lengths produce an empty string.
   *
   * @param length The number of hex characters to produce.
   */
  public hexString(length: number): string {
    const count = Math.max(0, Math.floor(length));
    let out = '';

    for (let i = 0; i < count; i++) {
      out += HEX_DIGITS[this.integer(0, 15)];
    }

    return out;
  }

  /**
   * Captures the current internal state of this generator as a 32-bit
   * unsigned integer. Pass the result back via `new Random({ state })` (or
   * {@link Random.setState}) to recreate a generator that resumes the stream
   * from exactly this point.
   */
  public getState(): number {
    return this._state >>> 0;
  }

  /**
   * Restores this generator's internal state to a value previously captured
   * by {@link Random.getState}. Non-finite inputs are ignored.
   *
   * @param state The state to restore.
   * @returns This generator, for chaining.
   */
  public setState(state: number): this {
    if (Number.isFinite(state)) {
      this._state = Math.floor(state) >>> 0;
    }

    return this;
  }

  // mulberry32: a 32-bit PRNG with a 2^32 period. Fast, tiny, good enough for
  // games. Returns the next raw 32-bit unsigned integer.
  private _next32(): number {
    this._state = (this._state + 0x6d2b79f5) | 0;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return (t ^ (t >>> 14)) >>> 0;
  }
}
