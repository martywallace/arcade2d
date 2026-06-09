import type { World } from '@arcade2d/engine';
import type { PropKey } from './assets';
import { GroundPrefab } from './objects/ground/ground.prefab';
import { createHouse } from './objects/house/house';
import { createProp } from './objects/prop/prop';
import { createSpawner } from './objects/spawner/spawner';

/** A scattered prop: art key, world position, and collider radius (0 = decor). */
type ScatterProp = readonly [PropKey, number, number, number];

const SCATTER: readonly ScatterProp[] = [
  ['tree', -1180, 240, 22],
  ['tree', -260, -760, 22],
  ['treeAutumn', 360, 620, 22],
  ['treeAutumn', 1180, -360, 22],
  ['tree', 180, -470, 22],
  ['hedge', -520, 520, 20],
  ['hedge', 1040, 560, 20],
  ['rock', -900, -340, 0],
  ['rock', 520, -180, 0],
  ['rock', -120, 360, 0],
];

const SPAWN_POINTS: readonly (readonly [number, number])[] = [
  [-1200, -900],
  [1200, -900],
  [0, 1150],
];

/**
 * Builds the whole static scene: the grass ground, two furnished houses, the
 * scattered outdoor props, and the zombie spawn points. Call once after the
 * world (with its {@link PhysicsWorld}) exists and the asset bundles are
 * loaded; spawn the player separately afterward so it renders on top.
 *
 * Order matters for draw depth — graphics render in creation order — so the
 * ground goes down first, then the buildings, then the props.
 *
 * @param world The world to populate.
 */
export function buildMap(world: World): void {
  world.createFromPrefab(GroundPrefab);

  // West house: a living room.
  createHouse(world, {
    center: { x: -640, y: -160 },
    tilesW: 6,
    tilesH: 5,
    furniture: [
      { key: 'rug', tx: 0, ty: 0.3 },
      { key: 'tableRound', tx: 0, ty: 0.3, collide: true },
      { key: 'sofaGreen', tx: -1.6, ty: -1.6, collide: true },
      {
        key: 'sofaOrange',
        tx: 1.6,
        ty: -1.6,
        collide: true,
        rotation: Math.PI,
      },
      { key: 'chairBlue', tx: 0, ty: 1.6 },
      { key: 'plant', tx: -2.2, ty: 1.7 },
    ],
  });

  // East house: a bedroom with some storage.
  createHouse(world, {
    center: { x: 720, y: 200 },
    tilesW: 5,
    tilesH: 5,
    furniture: [
      { key: 'bed', tx: -1.4, ty: -1.5, collide: true },
      { key: 'tableOrange', tx: 1.4, ty: -1.5, collide: true },
      { key: 'crate', tx: 1.6, ty: 1.5, collide: true },
      { key: 'crate', tx: 0.8, ty: 1.5, collide: true },
      { key: 'plant', tx: -1.8, ty: 1.6 },
    ],
  });

  for (const [key, x, y, radius] of SCATTER) {
    createProp(
      world,
      { x, y },
      key,
      radius > 0 ? { colliderRadius: radius } : {},
    );
  }

  for (const [x, y] of SPAWN_POINTS) {
    createSpawner(world, { x, y });
  }
}
