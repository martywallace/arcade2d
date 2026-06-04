import type { PointPrimitive, World } from '@arcade2d/engine';
import { PolygonGraphics, Rectangle, RigidBody } from '@arcade2d/engine';

const WALL_COLOR = 0x2b2b3a;

/**
 * Creates a single immovable wall: a `fixed` {@link RigidBody} with a matching
 * rectangle visual. Fixed bodies have infinite mass and never integrate, so
 * dynamic boxes and balls pile up against them.
 */
function createWall(
  world: World,
  position: PointPrimitive,
  width: number,
  height: number,
): void {
  const object = world.createEmpty(position, ['wall']);

  object.addComponentsFromFactories({
    graphics: (host) =>
      PolygonGraphics.asRectangle(host, width, height, WALL_COLOR),
    body: (host) =>
      new RigidBody(host, {
        type: 'fixed',
        collider: { shape: new Rectangle(width, height), friction: 0.8 },
      }),
  });
}

/**
 * Builds an open-topped bin — a floor and two side walls — centered on the
 * world origin, so spawned bodies fall in and settle instead of dropping off
 * the screen.
 */
export function createBin(world: World): void {
  createWall(world, { x: 0, y: 300 }, 920, 40); // floor
  createWall(world, { x: -440, y: 0 }, 40, 640); // left wall
  createWall(world, { x: 440, y: 0 }, 40, 640); // right wall
}
