import type { World } from '@arcade2d/engine';
import { createBuilding } from './objects/building/building';
import { GroundPrefab } from './objects/ground/ground.prefab';
import { createHouse } from './objects/house/house';
import type { PropCollider } from './objects/prop/prop';
import { createProp } from './objects/prop/prop';
import { createSpawner } from './objects/spawner/spawner';
import type { TileKey } from './tiles';

/** A scattered outdoor prop: which art, where, and (optionally) how it collides. */
interface ScatterProp {
  readonly key: TileKey;
  readonly x: number;
  readonly y: number;
  /** Omit for purely decorative props (small bushes, ground clutter). */
  readonly collider?: PropCollider;
  /** Sprite-and-collider rotation, in radians. */
  readonly rotation?: number;
}

const circle = (radius: number): PropCollider => ({ kind: 'circle', radius });
const box = (width: number, height: number): PropCollider => ({
  kind: 'box',
  width,
  height,
});

const SCATTER: readonly ScatterProp[] = [
  // Big 2x2 trees — solid trunks the player and bullets stop against.
  { key: 'treeGreen', x: -1180, y: 240, collider: circle(22) },
  { key: 'treeGreen', x: -260, y: -760, collider: circle(22) },
  { key: 'treeGreen', x: 180, y: -470, collider: circle(22) },
  { key: 'treeGreen', x: 1320, y: 520, collider: circle(22) },
  { key: 'treeAutumn', x: 360, y: 620, collider: circle(22) },
  { key: 'treeAutumn', x: 1180, y: -360, collider: circle(22) },
  { key: 'treeAutumn', x: -1000, y: 640, collider: circle(22) },

  // Saplings — smaller trunks, clustered near the big trees for a grove feel.
  { key: 'treeGreenSmall', x: -820, y: 420, collider: circle(13) },
  { key: 'treeAutumnSmall', x: 520, y: -620, collider: circle(13) },
  { key: 'treeGreenSmall', x: 980, y: -680, collider: circle(13) },

  // Shrubs — low ground cover, decorative so they don't snag movement.
  { key: 'bushGreen', x: -520, y: 520 },
  { key: 'bushAutumn', x: 1040, y: 560 },
  { key: 'bushGreen', x: -120, y: 360 },
  { key: 'bushAutumn', x: -300, y: 60 },
  { key: 'bushGreen', x: 300, y: 180 },

  // Rocks — solid now (the earlier scene left these without bodies, so the
  // player walked straight through them).
  { key: 'rock', x: -900, y: -340, collider: circle(18) },
  { key: 'rock', x: 520, y: -180, collider: circle(18) },
  { key: 'rock', x: -1300, y: -120, collider: circle(18) },
  { key: 'rockAngular', x: -460, y: -560, collider: circle(16), rotation: 0.5 },
  { key: 'rockSmall', x: -120, y: -300, collider: circle(11) },
  { key: 'rockSmall', x: 840, y: 700, collider: circle(11) },

  // Fallen logs — long box colliders, angled so the player is blocked along the
  // log's real outline rather than a square around it.
  { key: 'log', x: -700, y: 360, collider: box(54, 18), rotation: 0.6 },
  { key: 'log', x: 440, y: -260, collider: box(54, 18), rotation: -0.4 },
  { key: 'log', x: 1000, y: 120, collider: box(54, 18), rotation: 1.2 },

  // Crates — solid boxes left at jaunty angles to show the rotated colliders.
  { key: 'crate', x: -200, y: 640, collider: box(48, 48), rotation: 0.3 },
  { key: 'crate', x: 240, y: 760, collider: box(48, 48), rotation: -0.5 },
  { key: 'crate', x: 1240, y: 60, collider: box(48, 48), rotation: 0.8 },
];

const SPAWN_POINTS: readonly (readonly [number, number])[] = [
  [-1200, -900],
  [1200, -900],
  [-1200, 900],
  [1200, 900],
  [-1500, 100],
  [1500, 100],
  [0, 1150],
  [2400, -1250], // near the north-east building so that corner sees action
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

  // West house: a living room, canted ~30 degrees so its walls read as real
  // angled rigid bodies — the player slides along the slanted walls, which an
  // axis-aligned bounding box could never reproduce.
  createHouse(world, {
    center: { x: -640, y: -160 },
    tilesW: 6,
    tilesH: 5,
    rotation: Math.PI / 6, // 30 degrees
    furniture: [
      { key: 'rugGreen', tx: 0, ty: 0.3, floor: true },
      { key: 'tableRound', tx: 0, ty: 0.3, collide: true },
      { key: 'armchairGreen', tx: -1.8, ty: -1.5, collide: true },
      {
        key: 'armchairOrange',
        tx: 1.8,
        ty: -1.5,
        collide: true,
        rotation: Math.PI,
      },
      { key: 'armchairBlue', tx: 0, ty: 1.6, collide: true },
      { key: 'plant', tx: -2.4, ty: 1.6 },
    ],
  });

  // East house: a study/store room, tilted ~36 degrees the other way so the two
  // buildings sit at distinct, deliberately arbitrary angles.
  createHouse(world, {
    center: { x: 720, y: 200 },
    tilesW: 5,
    tilesH: 5,
    rotation: -Math.PI / 5, // -36 degrees
    furniture: [
      { key: 'rugBlue', tx: 0, ty: 0, floor: true },
      { key: 'tableSquare', tx: 1.3, ty: -1.4, collide: true },
      { key: 'armchairOrange', tx: -1.4, ty: -1.4, collide: true },
      { key: 'crate', tx: 1.6, ty: 1.5, collide: true },
      { key: 'crate', tx: 0.7, ty: 1.5, collide: true, rotation: 0.4 },
      { key: 'plant', tx: -1.7, ty: 1.6 },
    ],
  });

  // North-east: a larger structure — two rooms either side of a through-hallway,
  // each opening onto it, with the hallway open to the outside at its west end.
  // One floorplan, autotiled into walls; see createBuilding.
  createBuilding(world, {
    center: { x: 2050, y: -2000 },
    rotation: 0.15,
    // '#' = wall, '.' = floor. Door gaps are just floor left in a wall line.
    plan: [
      '###############',
      '#......#......#',
      '#......#......#',
      '#......#......#',
      '#......#......#',
      '#......#......#',
      '###..#####..###',
      '..............#',
      '..............#',
      '###..#####..###',
      '#......#......#',
      '#......#......#',
      '#......#......#',
      '#......#......#',
      '#......#......#',
      '###..#####..###',
    ],
    furniture: [
      // Top-left room: a sitting room.
      { key: 'rugGreen', col: 3.5, row: 3, floor: true },
      { key: 'tableRound', col: 3.5, row: 3, collide: true },
      { key: 'armchairGreen', col: 2, row: 1.7, collide: true },
      {
        key: 'armchairOrange',
        col: 5,
        row: 1.7,
        collide: true,
        rotation: Math.PI,
      },
      { key: 'plant', col: 1.4, row: 4.4 },
      // Top-right room: a study.
      { key: 'rugBlue', col: 10.5, row: 3, floor: true },
      { key: 'tableSquare', col: 11.4, row: 2, collide: true },
      { key: 'armchairBlue', col: 9.2, row: 2, collide: true },
      { key: 'crate', col: 12, row: 4.3, collide: true, rotation: 0.3 },
      { key: 'plant', col: 9, row: 4.4 },
      // Hallway: a little greenery by the entrance.
      { key: 'plant', col: 1.4, row: 7.5 },
      // Bottom-left room: a dining nook.
      { key: 'rugBlue', col: 3.5, row: 12, floor: true },
      { key: 'tableSquare', col: 3.5, row: 12, collide: true },
      { key: 'armchairOrange', col: 2, row: 10.8, collide: true },
      {
        key: 'armchairGreen',
        col: 5,
        row: 10.8,
        collide: true,
        rotation: Math.PI,
      },
      { key: 'plant', col: 5.4, row: 13.4 },
      // Bottom-right room: a storeroom of crates.
      { key: 'crate', col: 9.3, row: 10.8, collide: true, rotation: 0.2 },
      { key: 'crate', col: 10.3, row: 10.9, collide: true, rotation: -0.4 },
      { key: 'crate', col: 12, row: 13.2, collide: true, rotation: 0.5 },
      { key: 'tableRound', col: 11, row: 12, collide: true },
      { key: 'plant', col: 9, row: 13.4 },
    ],
  });

  for (const { key, x, y, collider, rotation } of SCATTER) {
    createProp(world, { x, y }, key, { collider, rotation });
  }

  for (const [x, y] of SPAWN_POINTS) {
    createSpawner(world, { x, y });
  }
}
