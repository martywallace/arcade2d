import type { PointPrimitive, World, WorldObject } from '@arcade2d/engine';
import { Circle, CircleGraphics, RigidBody } from '@arcade2d/engine';

const COLORS = [0xff9f1c, 0x2ec4b6, 0xe71d36, 0x8ac926, 0x4361ee];

/**
 * Spawns a bouncy dynamic ball at `position` with a randomised radius and
 * colour. The {@link Circle} collider matches the {@link CircleGraphics}
 * radius, and a higher restitution than {@link createBox} gives it some
 * bounce when it lands.
 */
export function createBall(
  world: World,
  position: PointPrimitive,
): WorldObject {
  const radius = 14 + Math.random() * 16;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;

  const object = world.createEmpty(position, ['ball']);

  object.addComponentsFromFactories({
    graphics: (host) => new CircleGraphics(host, new Circle(radius), color),
    body: (host) =>
      new RigidBody(host, {
        type: 'dynamic',
        collider: {
          shape: new Circle(radius),
          density: 1,
          friction: 0.4,
          restitution: 0.6,
        },
      }),
  });

  return object;
}
