import type { PointPrimitive, World, WorldObject } from '@arcade2d/engine';
import { SpawnerController } from './spawner.controller.component';

/**
 * Creates an invisible zombie spawn point at `position`. The returned object
 * carries only a {@link SpawnerController}, which maintains a small standing
 * population of zombies around the point and respawns them as they are killed.
 *
 * @param world The world to spawn into.
 * @param position Where the spawn point sits, in world pixels.
 * @returns The spawn-point object.
 */
export function createSpawner(
  world: World,
  position: PointPrimitive,
): WorldObject {
  const spawner = world.createEmpty(position, ['spawner']);

  spawner.addComponentsFromFactories({
    controller: (object) => new SpawnerController(object),
  });

  return spawner;
}
