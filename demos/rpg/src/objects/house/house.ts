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
import { furniture, terrain } from '../../assets';
import { TAG, TILE } from '../../constants';
import type { HouseConfig } from './house.types';

/** Half-width of the south-wall doorway, in pixels (a two-tile gap). */
const DOOR_HALF = TILE;

/** Footprint of a furniture collider, in pixels (a little inside its 64px art). */
const FURNITURE_COLLIDER = 48;

/** A wall panel in house-local space: a centred rectangle of tiled wall art. */
interface Panel {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Builds a house and returns its root object.
 *
 * The house is a single top-level {@link WorldObject} that demonstrates two
 * engine features at once:
 *
 * - **Parent/child hierarchy.** The floor, every wall strip, and every piece of
 *   furniture are child objects nested under the root and positioned in
 *   house-local space. Their world transforms compose the root's, so the whole
 *   building is one unit — and destroying the root cascades to all of it.
 * - **Compound physics colliders.** Rather than a body per wall, the root
 *   carries one `fixed` {@link RigidBody} whose colliders are the wall strips
 *   and solid furniture, each placed by a local `offset`. Because the root is a
 *   top-level object, those offsets land at the correct world positions. The
 *   root is tagged `structure`, so a bullet that hits any wall reports the
 *   house as its collision partner and is consumed.
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

  const wallTexture = new Texture(
    assets.use(terrain).getAs('wall', ImageAsset),
  );
  const floorTexture = new Texture(
    assets.use(terrain).getAs('floorWood', ImageAsset),
  );

  const outerW = (tilesW + 2) * TILE;
  const outerH = (tilesH + 2) * TILE;
  const hw = outerW / 2;
  const hh = outerH / 2;
  const t = TILE; // wall thickness

  // Five wall strips: a full north wall, full east/west walls spanning the
  // interior height, and the south wall split into two segments around the
  // central doorway.
  const panels: Panel[] = [
    { x: 0, y: -hh + t / 2, w: outerW, h: t },
    { x: -hw + t / 2, y: 0, w: t, h: outerH - 2 * t },
    { x: hw - t / 2, y: 0, w: t, h: outerH - 2 * t },
    { x: -(hw + DOOR_HALF) / 2, y: hh - t / 2, w: hw - DOOR_HALF, h: t },
    { x: (hw + DOOR_HALF) / 2, y: hh - t / 2, w: hw - DOOR_HALF, h: t },
  ];

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
      }),
  );

  // Walls: a tiled strip child + a matching collider for each panel.
  for (const panel of panels) {
    addChild(
      world,
      root,
      panel.x,
      panel.y,
      (object) =>
        new TilingSprite(object, wallTexture, {
          width: panel.w,
          height: panel.h,
        }),
    );

    colliders.push({
      shape: new Rectangle(panel.w, panel.h),
      offset: { x: panel.x, y: panel.y },
    });
  }

  // Furniture: a sprite child, plus a collider for the solid pieces.
  for (const piece of config.furniture ?? []) {
    const lx = piece.tx * TILE;
    const ly = piece.ty * TILE;
    const texture = new Texture(
      assets.use(furniture).getAs(piece.key, ImageAsset),
    );

    const child = addChild(
      world,
      root,
      lx,
      ly,
      (object) => new Sprite(object, texture),
    );
    child.rotation = piece.rotation ?? 0;

    if (piece.collide) {
      colliders.push({
        shape: new Rectangle(FURNITURE_COLLIDER, FURNITURE_COLLIDER),
        offset: { x: lx, y: ly },
      });
    }
  }

  // One compound static body carries every wall and solid-furniture collider.
  root.addComponentsFromFactories({
    body: (object) => new RigidBody(object, { type: 'fixed', colliders }),
  });

  return root;
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
