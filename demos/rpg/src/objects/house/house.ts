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
import type { HouseConfig } from './house.types';

/** Footprint of a furniture collider, in pixels (a little inside its 64px art). */
const FURNITURE_COLLIDER = 48;

/**
 * Builds a house and returns its root object.
 *
 * The house is a single top-level {@link WorldObject} that demonstrates two
 * engine features at once:
 *
 * - **Parent/child hierarchy.** The floor, every wall tile, and every piece of
 *   furniture are child objects nested under the root and positioned in
 *   house-local space. The walls are laid as a one-tile-thick ring of autotiled
 *   sprites — corners, straight runs, and capped ends beside the doorway — whose
 *   orange outlines join into one unbroken edge. Their world transforms compose
 *   the root's, so the whole building is one unit, and destroying the root
 *   cascades to all of it.
 * - **Compound physics colliders.** Rather than a body per tile, the root
 *   carries one `fixed` {@link RigidBody} whose colliders are a handful of wall
 *   rectangles and the solid furniture, each placed by a local `offset`. Because
 *   the root is a top-level object, those offsets land at the correct world
 *   positions. The root is tagged `structure`, so a bullet that hits any wall
 *   reports the house as its collision partner and is consumed.
 * - **Rotated rigid bodies.** Setting {@link HouseConfig.rotation} turns the
 *   root before the body is built, so the whole compound — every wall and
 *   furniture collider — is seeded into Rapier already rotated. The player
 *   slides along the real angled walls; this is genuine rigid-body physics, not
 *   an axis-aligned bounding box pretending otherwise.
 *
 * A doorway gap is left in the middle of the south wall so the player can enter.
 *
 * @param world The world to build into.
 * @param config Placement, interior size, and furniture. See {@link HouseConfig}.
 * @returns The house root object.
 */
export function createHouse(world: World, config: HouseConfig): WorldObject {
  const { center, tilesW, tilesH } = config;
  const assets = world.game.assets;

  const floorTexture = new Texture(
    assets.use(terrain).getAs('floorWood', ImageAsset),
  );

  // The wall is a one-tile-thick ring around the interior, so the full footprint
  // is the interior plus a tile of wall on every side.
  const cols = tilesW + 2;
  const rows = tilesH + 2;
  const hw = (cols * TILE) / 2;
  const hh = (rows * TILE) / 2;
  const t = TILE; // wall thickness

  // The doorway is a centred gap in the south wall. Sizing it in whole tiles
  // (and matching its parity to the wall's) keeps it symmetric, and means the
  // wall sprites and the colliders below carve the gap at exactly the same
  // place — no art a body can clip through, no invisible wall in the opening.
  const doorTiles = cols % 2 === 0 ? 2 : 3;
  const doorStart = (cols - doorTiles) / 2;
  const doorEnd = doorStart + doorTiles;

  const cellX = (col: number): number => -hw + (col + 0.5) * TILE;
  const cellY = (row: number): number => -hh + (row + 0.5) * TILE;

  const root = world.createEmpty(center, [TAG.structure]);
  const colliders: ColliderOptions[] = [];

  // Floor first so it renders behind everything else in the house.
  addChild(
    world,
    root,
    0,
    0,
    (object) =>
      new TilingSprite(object, floorTexture, {
        width: tilesW * TILE,
        height: tilesH * TILE,
        layer: layers.get('ground'),
      }),
  );

  // Walls: one autotiled sprite per ring cell. Picking the piece by the cell's
  // position — corner where two edges meet, a capped end beside the doorway, a
  // straight run otherwise — makes the orange outline join seamlessly all the
  // way round. The south doorway cells themselves are left empty.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const onN = row === 0;
      const onS = row === rows - 1;
      const onW = col === 0;
      const onE = col === cols - 1;

      if (!(onN || onS || onW || onE)) {
        continue; // interior cell — floor, not wall
      }

      if (onS && col >= doorStart && col < doorEnd) {
        continue; // doorway gap
      }

      const key = wallKey(col, row, cols, rows, doorStart, doorEnd);
      const texture = wallTexture(assets, key);

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

  // Colliders: five rectangles spanning the same cells the sprites cover — a
  // full north wall, east/west walls between the corners, and the south wall
  // split into the runs flanking the doorway. Far fewer bodies than one per
  // tile, and derived from the same `doorStart`/`doorEnd` so they line up with
  // the art exactly.
  const interiorH = (rows - 2) * TILE;

  colliders.push(
    { shape: new Rectangle(cols * TILE, t), offset: { x: 0, y: cellY(0) } },
    { shape: new Rectangle(t, interiorH), offset: { x: cellX(0), y: 0 } },
    {
      shape: new Rectangle(t, interiorH),
      offset: { x: cellX(cols - 1), y: 0 },
    },
  );

  if (doorStart > 0) {
    colliders.push({
      shape: new Rectangle(doorStart * TILE, t),
      offset: { x: -hw + (doorStart * TILE) / 2, y: cellY(rows - 1) },
    });
  }

  if (doorEnd < cols) {
    colliders.push({
      shape: new Rectangle((cols - doorEnd) * TILE, t),
      offset: { x: hw - ((cols - doorEnd) * TILE) / 2, y: cellY(rows - 1) },
    });
  }

  // Furniture: a sprite child, plus a collider for the solid pieces.
  for (const piece of config.furniture ?? []) {
    const lx = piece.tx * TILE;
    const ly = piece.ty * TILE;
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

  // Rotate the root only now that every child is parented. `addChild` defaults
  // to keepWorldTransform, so a child added to an already-rotated root would
  // get a counter-rotation baked into its local transform that cancels the
  // turn — the walls would look axis-aligned while only the body rotated. With
  // the children in place first, the rotation composes cleanly down the
  // hierarchy, and the fixed body (attached next) reads it once so the whole
  // compound collider lands at the same angle.
  root.rotation = config.rotation ?? 0;

  // One compound static body carries every wall and solid-furniture collider.
  root.addComponentsFromFactories({
    body: (object) => new RigidBody(object, { type: 'fixed', colliders }),
  });

  return root;
}

/**
 * Picks the wall autotile piece for a ring cell from where it sits on the
 * perimeter: an outer corner where two edges meet, a capped end on the south
 * cells flanking the doorway, otherwise a straight run (`horizontal` for the
 * north/south edges, `vertical` for east/west).
 */
function wallKey(
  col: number,
  row: number,
  cols: number,
  rows: number,
  doorStart: number,
  doorEnd: number,
): WallKey {
  const onN = row === 0;
  const onS = row === rows - 1;
  const onW = col === 0;
  const onE = col === cols - 1;

  if (onN && onW) {
    return 'cornerNW';
  }

  if (onN && onE) {
    return 'cornerNE';
  }

  if (onS && onW) {
    return 'cornerSW';
  }

  if (onS && onE) {
    return 'cornerSE';
  }

  // South cells abutting the doorway gap cap the outline around the opening.
  if (onS && col === doorStart - 1) {
    return 'capE';
  }

  if (onS && col === doorEnd) {
    return 'capW';
  }

  return onN || onS ? 'horizontal' : 'vertical';
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
