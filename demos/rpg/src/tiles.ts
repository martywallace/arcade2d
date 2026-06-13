import type { AssetLibrary, TextureFrame } from '@arcade2d/engine';
import { ImageAsset, Texture } from '@arcade2d/engine';
import { tilesheet } from './assets';
import { TILE } from './constants';

/**
 * Columns in the Kenney `tilesheet_complete` atlas. Tiles are packed edge to
 * edge with no gutter, so a tile's pixel origin is just its grid cell times
 * {@link TILE}.
 */
const SHEET_COLUMNS = 27;

/**
 * Builds the source-pixel {@link TextureFrame} for a run of atlas tiles.
 *
 * Tiles are addressed by their 1-based index in the Kenney sheet (the number in
 * each `tile_NNN.png` filename), counting left-to-right then top-to-bottom.
 * `width`/`height` are in tiles, so a multi-cell object — a 2x2 tree, say — is
 * one call naming its top-left tile and its span.
 *
 * @param index 1-based index of the object's top-left tile.
 * @param width Object width in tiles. Defaults to 1.
 * @param height Object height in tiles. Defaults to 1.
 */
function frame(index: number, width = 1, height = 1): TextureFrame {
  const cell = index - 1;
  const column = cell % SHEET_COLUMNS;
  const row = Math.floor(cell / SHEET_COLUMNS);

  return {
    x: column * TILE,
    y: row * TILE,
    width: width * TILE,
    height: height * TILE,
  };
}

/**
 * Every discrete sprite the scene draws, as a named region of the shared
 * {@link tilesheet}. Picking *complete* objects here is what fixes the
 * "half a sprite" look of the earlier per-tile art: the trees are the full 2x2
 * canopy, not the top-left quarter, and the orange couch is the whole couch.
 *
 * Resolve a key to a drawable with {@link tileTexture}.
 */
export const TILE_FRAMES = {
  // --- Outdoor props -------------------------------------------------------
  // The big trees are genuinely 2x2 objects in the source art; naming the
  // top-left tile with a 2x2 span draws the whole canopy.
  treeGreen: frame(181, 2, 2),
  treeAutumn: frame(184, 2, 2),
  treeGreenSmall: frame(183),
  treeAutumnSmall: frame(186),
  bushGreen: frame(235),
  bushAutumn: frame(236),
  rock: frame(237),
  rockSmall: frame(238),
  rockAngular: frame(239),
  log: frame(265),
  crate: frame(129),

  // --- Indoor furniture ----------------------------------------------------
  rugBlue: frame(131),
  rugGreen: frame(158),
  tableRound: frame(132),
  tableSquare: frame(457),
  armchairGreen: frame(450),
  armchairBlue: frame(451),
  armchairOrange: frame(477),
  plant: frame(134),
} as const;

/** A drawable region of the atlas — a key of {@link TILE_FRAMES}. */
export type TileKey = keyof typeof TILE_FRAMES;

/**
 * The Kenney wall autotile set — every shape a one-tile-thick wall network can
 * take, so a layout can be rendered by stamping the piece that matches each wall
 * cell's neighbours.
 *
 * Each piece is the **double-line** variant: a continuous orange outline framing
 * the darker wall *top*, so adjacent pieces join into one unbroken orange edge on
 * both faces — matching the pack's sample scene. The set is exhaustive over the
 * 16 ways a cell can connect to its four orthogonal neighbours; the rule a piece
 * obeys is *orange caps the edges with no neighbour, the wall top continues
 * through the edges that do connect.* {@link createBuilding} relies on exactly
 * this to autotile arbitrary floorplans.
 *
 * - `horizontal` / `vertical` — a straight run (two opposite neighbours).
 * - `cornerNW` / `cornerNE` / `cornerSW` / `cornerSE` — an outer corner (two
 *   perpendicular neighbours); named for the outer angle it wraps.
 * - `teeN` / `teeS` / `teeE` / `teeW` — a T-junction (three neighbours); named
 *   for the direction its stem points.
 * - `capN` / `capS` / `capE` / `capW` — a terminating end (one neighbour); named
 *   for the side the cap faces, i.e. the *opposite* of the neighbour.
 * - `cross` — a four-way crossing. `post` — an isolated block (no neighbours).
 */
export const WALL_FRAMES = {
  horizontal: frame(111),
  vertical: frame(138),
  cornerNW: frame(116),
  cornerNE: frame(117),
  cornerSW: frame(143),
  cornerSE: frame(144),
  teeN: frame(113),
  teeS: frame(112),
  teeE: frame(139),
  teeW: frame(140),
  capN: frame(141),
  capS: frame(115),
  capE: frame(114),
  capW: frame(142),
  cross: frame(170),
  post: frame(171),
} as const;

/** One wall piece in the autotile set — a key of {@link WALL_FRAMES}. */
export type WallKey = keyof typeof WALL_FRAMES;

/**
 * Builds a {@link Texture} for one named atlas region. The atlas must already
 * be loaded (see `main.ts`). Cheap to call per object — every texture shares
 * the atlas's single GPU source and only wraps it with a frame rectangle.
 *
 * @param assets The game asset library (`world.game.assets`).
 * @param key Which region to draw — a key of {@link TILE_FRAMES}.
 */
export function tileTexture(assets: AssetLibrary, key: TileKey): Texture {
  const sheet = assets.use(tilesheet).getAs('sheet', ImageAsset);

  return new Texture(sheet, TILE_FRAMES[key]);
}

/**
 * Builds a {@link Texture} for one wall autotile piece — the wall counterpart of
 * {@link tileTexture}, reading from {@link WALL_FRAMES} instead. Same atlas, same
 * cheap per-call wrapping.
 *
 * @param assets The game asset library (`world.game.assets`).
 * @param key Which wall piece to draw — a key of {@link WALL_FRAMES}.
 */
export function wallTexture(assets: AssetLibrary, key: WallKey): Texture {
  const sheet = assets.use(tilesheet).getAs('sheet', ImageAsset);

  return new Texture(sheet, WALL_FRAMES[key]);
}
