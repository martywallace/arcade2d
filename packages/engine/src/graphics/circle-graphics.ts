import { Graphics as PixiGraphics } from 'pixi.js';
import { Circle } from '../geometry';
import { PointPrimitive } from '../geometry/point';
import { WorldObject } from '../world';
import { AbstractGraphics } from './abstract-graphics';

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
  /**
   * @param host The world object the circle is attached to.
   * @param circle The circle shape to draw. Stored as-is for inspection;
   * mutating the original (it has no public mutators, but cloning rules
   * still apply) does not retroactively redraw the component.
   * @param fill The fill color, as a 24-bit RGB integer. Defaults to white.
   */
  constructor(
    host: WorldObject,
    public readonly circle: Circle,
    fill: number = 0xffffff,
  ) {
    const display = new PixiGraphics();

    if (circle.radius > 0) {
      display.circle(0, 0, circle.radius).fill(fill);
    }

    super(host, display);
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
