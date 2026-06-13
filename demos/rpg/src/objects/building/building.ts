import type {
  ColliderOptions,
  Component,
  World,
  WorldObject,
} from '@arcade2d/engine';
import {
  ImageAsset,
  Rectangle,
  RigidBody,
  Sprite,
  Texture,
  TilingSprite,
} from '@arcade2d/engine';
import { terrain } from '../../assets';
import { TAG, TILE } from '../../constants';
import { layers } from '../../layers';
import type { WallKey } from '../../tiles';
import { tileTexture, wallTexture } from '../../tiles';
import type { BuildingConfig } from './building.types';

/** Footprint of a furniture collider, in pixels (a little inside its 64px art). */
const FURNITURE_COLLIDER = 48;

/**
 * Builds a multi-room building from a grid floorplan and returns its root.
 *
 * Where {@link createHouse} draws a single rectangular room, this lays out an
 * arbitrary plan — a hallway and several rooms, interior dividing walls, doors
 * between them — and demonstrates the same three engine features at a larger
 * scale:
 *
 * - **Parent/child hierarchy.** The floor, every wall tile, and every furniture
 *   sprite are children of one root in building-local space, so the whole
 *   structure moves, rotates, and is destroyed as a unit.
 * - **Autotiled walls.** Each `#` in {@link BuildingConfig.plan} becomes a wall
 *   sprite whose piece is chosen from its four neighbours (see {@link wallKey}),
 *   so straight runs, corners, the T-junctions where an interior wall meets
 *   another, and the capped ends framing every doorway all emerge from the
 *   layout. A doorway is just a gap of floor cells left in a wall line.
 * - **Compound physics colliders.** Contiguous wall cells are merged into a
 *   handful of rectangles (long runs first horizontally, then vertically) that
 *   ride on one `fixed` {@link RigidBody}, far fewer bodies than one per tile.
 *   The root is tagged `structure`, so a bullet stops on any wall.
 *
 * Setting {@link BuildingConfig.rotation} turns the root before the body is
 * built, so the whole compound is seeded into Rapier already rotated and the
 * player slides along the real angled walls.
 *
 * @param world The world to build into.
 * @param config Placement, floorplan, rotation, and furniture.
 * @returns The building root object.
 * @throws A plain `Error` if the plan rows are not all the same length.
 */
export function createBuilding(
  world: World,
  config: BuildingConfig,
): WorldObject {
  const { center, plan } = config;
  const assets = world.game.assets;

  const rows = plan.length;
  const cols = plan[0]?.length ?? 0;

  if (plan.some((row) => row.length !== cols)) {
    throw new Error('createBuilding: every plan row must be the same length');
  }

  const floorTexture = new Texture(
    assets.use(terrain).getAs('floorWood', ImageAsset),
  );

  // Cell centres in building-local space, with the whole grid centred on the
  // origin so the configured rotation turns about the building's middle.
  const cellX = (col: number): number => (col - (cols - 1) / 2) * TILE;
  const cellY = (row: number): number => (row - (rows - 1) / 2) * TILE;
  const isWall = (col: number, row: number): boolean =>
    row >= 0 &&
    row < rows &&
    col >= 0 &&
    col < cols &&
    plan[row]?.[col] === '#';

  const root = world.createEmpty(center, [TAG.structure]);
  const colliders: ColliderOptions[] = [];

  // Floor first, under everything — one wood fill across the whole footprint, so
  // every room, the hallway, and the door thresholds share it.
  addChild(
    world,
    root,
    0,
    0,
    (object) =>
      new TilingSprite(object, floorTexture, {
        width: cols * TILE,
        height: rows * TILE,
        layer: layers.get('ground'),
      }),
  );

  // Walls: one autotiled sprite per `#` cell, the piece chosen from which of its
  // four neighbours are also walls.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isWall(col, row)) {
        continue;
      }

      const texture = wallTexture(
        assets,
        wallKey(
          isWall(col, row - 1),
          isWall(col + 1, row),
          isWall(col, row + 1),
          isWall(col - 1, row),
        ),
      );

      addChild(
        world,
        root,
        cellX(col),
        cellY(row),
        (object) =>
          new Sprite(object, texture, { layer: layers.get('structures') }),
      );
    }
  }

  addWallColliders(colliders, cols, rows, isWall, cellX, cellY);

  // Furniture: a sprite child, plus a collider for the solid pieces.
  for (const piece of config.furniture ?? []) {
    const lx = cellX(piece.col);
    const ly = cellY(piece.row);
    const texture = tileTexture(assets, piece.key);

    const child = addChild(
      world,
      root,
      lx,
      ly,
      (object) =>
        new Sprite(object, texture, {
          layer: layers.get(piece.floor ? 'ground' : 'structures'),
        }),
    );
    child.rotation = piece.rotation ?? 0;

    if (piece.collide) {
      colliders.push({
        shape: new Rectangle(FURNITURE_COLLIDER, FURNITURE_COLLIDER),
        offset: { x: lx, y: ly },
      });
    }
  }

  // Rotate once every child is parented (addChild keeps world transform, so a
  // child added to an already-rotated root would bake in a cancelling local
  // turn), then attach the body so the compound collider reads the angle once.
  root.rotation = config.rotation ?? 0;

  root.addComponentsFromFactories({
    body: (object) => new RigidBody(object, { type: 'fixed', colliders }),
  });

  return root;
}

/**
 * Picks the wall autotile piece for a cell from which of its four orthogonal
 * neighbours are also walls: a corner for two perpendicular neighbours, a
 * straight for two opposite ones, a T-junction for three, a cap for one, and the
 * cross/post degenerate cases. The orange outline always caps the edges *without*
 * a neighbour, so the piece falls straight out of the count and arrangement.
 */
function wallKey(n: boolean, e: boolean, s: boolean, w: boolean): WallKey {
  const count = Number(n) + Number(e) + Number(s) + Number(w);

  if (count === 0) {
    return 'post';
  }

  if (count === 4) {
    return 'cross';
  }

  if (count === 1) {
    if (n) {
      return 'capS';
    }

    if (e) {
      return 'capW';
    }

    return s ? 'capN' : 'capE';
  }

  if (count === 3) {
    if (!n) {
      return 'teeS';
    }

    if (!e) {
      return 'teeW';
    }

    return !s ? 'teeN' : 'teeE';
  }

  // Two neighbours: a straight run if they're opposite, else an outer corner
  // named for the angle it wraps.
  if (n && s) {
    return 'vertical';
  }

  if (e && w) {
    return 'horizontal';
  }

  if (e && s) {
    return 'cornerNW';
  }

  if (s && w) {
    return 'cornerNE';
  }

  return n && e ? 'cornerSW' : 'cornerSE';
}

/**
 * Merges the wall cells into as few rectangle colliders as practical: greedy
 * maximal horizontal strips first (claiming runs of two or more), then vertical
 * strips over whatever is left. Long outer walls become one rectangle each and a
 * tall interior divider a single tall one, instead of a body per tile.
 */
function addWallColliders(
  colliders: ColliderOptions[],
  cols: number,
  rows: number,
  isWall: (col: number, row: number) => boolean,
  cellX: (col: number) => number,
  cellY: (row: number) => number,
): void {
  const claimed = new Uint8Array(cols * rows);
  const index = (col: number, row: number): number => row * cols + col;

  const push = (x: number, y: number, w: number, h: number): void => {
    colliders.push({ shape: new Rectangle(w, h), offset: { x, y } });
  };

  // Horizontal strips of length >= 2.
  for (let row = 0; row < rows; row++) {
    let col = 0;

    while (col < cols) {
      if (!isWall(col, row) || claimed[index(col, row)]) {
        col++;
        continue;
      }

      let end = col;

      while (end + 1 < cols && isWall(end + 1, row)) {
        end++;
      }

      if (end > col) {
        for (let k = col; k <= end; k++) {
          claimed[index(k, row)] = 1;
        }

        push(
          (cellX(col) + cellX(end)) / 2,
          cellY(row),
          (end - col + 1) * TILE,
          TILE,
        );
      }

      col = end + 1;
    }
  }

  // Vertical strips over everything still unclaimed (covers tall dividers and
  // any single cells the horizontal pass skipped).
  for (let col = 0; col < cols; col++) {
    let row = 0;

    while (row < rows) {
      if (!isWall(col, row) || claimed[index(col, row)]) {
        row++;
        continue;
      }

      let end = row;

      while (
        end + 1 < rows &&
        isWall(col, end + 1) &&
        !claimed[index(col, end + 1)]
      ) {
        end++;
      }

      for (let k = row; k <= end; k++) {
        claimed[index(col, k)] = 1;
      }

      push(
        cellX(col),
        (cellY(row) + cellY(end)) / 2,
        TILE,
        (end - row + 1) * TILE,
      );

      row = end + 1;
    }
  }
}

/**
 * Creates a child object at a local offset under `parent`, attaches the graphics
 * the factory builds, and returns it.
 */
function addChild(
  world: World,
  parent: WorldObject,
  localX: number,
  localY: number,
  graphics: (object: WorldObject) => Component<WorldObject>,
): WorldObject {
  const child = world.createEmpty();
  parent.addChild(child);
  child.position.set(localX, localY);
  child.addComponentsFromFactories({ graphics });

  return child;
}
