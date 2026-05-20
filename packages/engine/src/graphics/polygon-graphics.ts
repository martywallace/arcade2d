import { Graphics as PixiGraphics } from 'pixi.js';
import { Polygon } from '../geometry';
import { PointPrimitive } from '../geometry/point';
import { WorldObject } from '../world';
import { AbstractGraphics } from './abstract-graphics';

/**
 * Renders a filled {@link Polygon} attached to a {@link WorldObject}. The
 * polygon's vertices are interpreted in the host's local space: vertex
 * `(0, 0)` is the host's position, and the polygon rotates and scales with
 * the host because the underlying display object's transform is driven by
 * {@link AbstractGraphics}.
 *
 * Two static helpers — {@link PolygonGraphics.asRectangle} and
 * {@link PolygonGraphics.asLine} — produce the two shapes that come up most
 * often (a centered rectangle and an oriented line segment) without forcing
 * the caller to build the vertex list by hand.
 *
 * @example
 * ```ts
 * import { Polygon, PolygonGraphics } from '@arcade2d/engine';
 *
 * // Custom polygon from explicit vertices.
 * const triangle = new Polygon([
 *   { x: 0, y: -10 },
 *   { x: 10, y: 10 },
 *   { x: -10, y: 10 },
 * ]);
 * new PolygonGraphics(object, triangle, 0x44ccff);
 *
 * // Centered rectangle convenience helper.
 * PolygonGraphics.asRectangle(object, 32, 32, 0xffaa00);
 *
 * // Oriented line as a thin rectangle polygon.
 * PolygonGraphics.asLine(object, { x: 0, y: 0 }, { x: 50, y: 20 }, 2);
 * ```
 */
export class PolygonGraphics extends AbstractGraphics<PixiGraphics> {
  /**
   * Constructs a {@link PolygonGraphics} representing a rectangle centered
   * on the host's local origin. Useful for the common "draw a box at this
   * object's position" case where the caller doesn't want to build the
   * vertex list themselves.
   *
   * Note that the rectangle this produces differs from
   * {@link Rectangle the geometry shape} — the geometry `Rectangle` is
   * top-left anchored, but here vertices are emitted centered on `(0, 0)`
   * so the visual sits on top of the host position rather than offset
   * down-right of it.
   *
   * @param host The world object to attach the graphics to.
   * @param width The rectangle width in world units.
   * @param height The rectangle height in world units.
   * @param fill The fill color as a 24-bit RGB integer. Defaults to white.
   */
  public static asRectangle(
    host: WorldObject,
    width: number,
    height: number,
    fill: number = 0xffffff,
  ): PolygonGraphics {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    return new PolygonGraphics(
      host,
      new Polygon([
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight },
      ]),
      fill,
    );
  }

  /**
   * Constructs a {@link PolygonGraphics} representing a line segment drawn
   * as a thin oriented rectangle. The line runs from `from` to `to` (both
   * in the host's local space) and is `thickness` units wide perpendicular
   * to that direction.
   *
   * A zero-length segment produces an empty polygon — the component will
   * still attach and tick, but it draws nothing until the caller produces
   * a fresh instance with a non-degenerate segment.
   *
   * @param host The world object to attach the graphics to.
   * @param from The starting point in the host's local space.
   * @param to The ending point in the host's local space.
   * @param thickness The line's width perpendicular to its direction.
   * Expected to be non-negative.
   * @param fill The fill color as a 24-bit RGB integer. Defaults to white.
   */
  public static asLine(
    host: WorldObject,
    from: PointPrimitive,
    to: PointPrimitive,
    thickness: number,
    fill: number = 0xffffff,
  ): PolygonGraphics {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return new PolygonGraphics(host, new Polygon([]), fill);
    }

    // Perpendicular to (dx, dy), scaled to half-thickness, so the resulting
    // rectangle is centered on the original segment.
    const px = (-dy / length) * (thickness / 2);
    const py = (dx / length) * (thickness / 2);

    return new PolygonGraphics(
      host,
      new Polygon([
        { x: from.x + px, y: from.y + py },
        { x: to.x + px, y: to.y + py },
        { x: to.x - px, y: to.y - py },
        { x: from.x - px, y: from.y - py },
      ]),
      fill,
    );
  }

  /**
   * @param host The world object the polygon is attached to.
   * @param polygon The polygon shape to draw. Stored as-is for inspection.
   * Polygons with fewer than three vertices produce no draw output.
   * @param fill The fill color, as a 24-bit RGB integer. Defaults to white.
   */
  constructor(
    host: WorldObject,
    public readonly polygon: Polygon,
    fill: number = 0xffffff,
  ) {
    const display = new PixiGraphics();

    if (polygon.points.length >= 3) {
      // Pixi's `poly` API accepts `{ x, y }` records directly; close the ring
      // explicitly so behaviour matches `Polygon`'s implicit-closure contract.
      display
        .poly(polygon.points.map((point) => ({ x: point.x, y: point.y })), true)
        .fill(fill);
    }

    super(host, display);
  }
}
