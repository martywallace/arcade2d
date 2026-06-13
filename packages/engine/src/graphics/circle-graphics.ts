import { Graphics as PixiGraphics } from 'pixi.js';
import { Circle } from '../geometry';
import type { PointPrimitive } from '../geometry/point.types';
import { WorldObject } from '../world';
import { AbstractGraphics } from './abstract-graphics';
import type { ShapeGraphicsOptions } from './shape-graphics.types';

/**
 * Renders a filled {@link Circle} centered on the host's position. The circle
 * geometry is positionless — its placement on screen comes from the host
 * {@link WorldObject}'s transform, synced once per frame by
 * {@link AbstractGraphics}.
 *
 * @example
 * ```ts
 * import { Circle, CircleGraphics } from '@arcade2d/engine';
 *
 * world.createObject({
 *   components: ({ object }) => ({
 *     graphics: () => new CircleGraphics(object, new Circle(16), 0xff00aa),
 *   }),
 * });
 * ```
 */
export class CircleGraphics extends AbstractGraphics<PixiGraphics> {
  private _fill: number;

  /**
   * @param host The world object the circle is attached to.
   * @param circle The circle shape to draw. Stored as-is for inspection.
   * @param fill The fill color, as a 24-bit RGB integer. Defaults to white.
   * Change it later by assigning {@link CircleGraphics.fill}.
   * @param options Optional {@link ShapeGraphicsOptions} (alpha, visibility).
   */
  constructor(
    host: WorldObject,
    public readonly circle: Circle,
    fill: number = 0xffffff,
    options: ShapeGraphicsOptions = {},
  ) {
    super(host, new PixiGraphics(), options);

    this._fill = fill;
    this._redraw();
  }

  /**
   * The fill colour, as a 24-bit RGB integer. Assigning re-issues the fill
   * into the underlying renderer graphic — the common case for a shape that
   * flashes or changes state (a hit flash, a selection highlight) without
   * rebuilding the component. Settable to match {@link Text.fill} and the
   * `tint` accessor on textured graphics, rather than a `setX()` method.
   */
  public get fill(): number {
    return this._fill;
  }

  public set fill(value: number) {
    this._fill = value;
    this._redraw();
  }

  // Clears and re-fills the renderer graphic from the current shape + fill.
  private _redraw(): void {
    this.raw.clear();

    if (this.circle.radius > 0) {
      this.raw.circle(0, 0, this.circle.radius).fill(this._fill);
    }
  }

  /**
   * Returns `true` if the given **world-space** point lies inside this
   * circle, accounting for the host's position, rotation, and scale.
   * Composes {@link WorldObject.worldToLocal} with the underlying
   * {@link Circle.containsPoint}; under non-uniform scale, the test
   * becomes against the *scaled* shape (the local point's coordinates are
   * divided per-axis), which matches what's drawn on screen.
   *
   * @param point The world-space point to test.
   */
  public containsWorldPoint(point: PointPrimitive): boolean {
    return this.circle.containsPoint(this.host.worldToLocal(point));
  }
}
