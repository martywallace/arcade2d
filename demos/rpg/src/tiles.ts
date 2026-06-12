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
