import type { PointPrimitive, World, WorldObject } from '@arcade2d/engine';
import { PolygonGraphics, Rectangle, RigidBody } from '@arcade2d/engine';

const COLORS = [0xff5c57, 0xffd23f, 0x4cd4b0, 0x5c8dff, 0xc66bff];

/**
 * Spawns a dynamic square box at `position` with a randomised size and colour.
 *
 * The visual is a centered rectangle ({@link PolygonGraphics.asRectangle}) and
 * the collider is a {@link Rectangle} of the same extents — both are centered
 * on the object's origin, so the box you see is exactly the box that collides.
 */
export function createBox(world: World, position: PointPrimitive): WorldObject {
  const size = 28 + Math.random() * 34;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;

  const object = world.createEmpty(position, ['box']);

  object.addComponentsFromFactories({
    graphics: (host) => PolygonGraphics.asRectangle(host, size, size, color),
    body: (host) =>
      new RigidBody(host, {
        type: 'dynamic',
        collider: {
          shape: new Rectangle(size, size),
          density: 1,
          friction: 0.7,
          restitution: 0.1,
        },
        angularVelocity: (Math.random() - 0.5) * 4,
      }),
  });

  return object;
}
