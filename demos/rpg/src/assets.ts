import { defineAssetBundle } from '@arcade2d/engine';

// Characters (Kenney Topdown Shooter, CC0). The sprites face east (+x), which
// matches the engine's rotation=0 convention, so a facing angle maps straight
// onto `host.rotation` with no offset.
import playerUrl from '../assets/kenney_top-down-shooter/PNG/Survivor 1/survivor1_gun.png';
import zombieUrl from '../assets/kenney_top-down-shooter/PNG/Zombie 1/zoimbie1_hold.png';

// Terrain tiles, used as tiled fills (grass ground, wood floors). These stay as
// standalone single-tile images on purpose: a TilingSprite repeats its whole
// texture source, so sampling a sub-region of a packed atlas would bleed
// neighbouring tiles in at every seam. A frame of the shared tilesheet is the
// right tool for discrete sprites (see `tiles.ts`), not for tiled fills. The
// walls are discrete autotile frames now (see `WALL_FRAMES`), not a tiled fill.
import grassUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_01.png';
import floorWoodUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_42.png';

// The complete Kenney tile atlas: a 27x20 grid of 64px tiles in one image.
// Every discrete prop and furniture sprite is a `Texture` frame carved out of
// this one source (see `tiles.ts`) — including the multi-tile objects (the
// 2x2 trees) that a single 64px tile would only show a quarter of.
import tilesheetUrl from '../assets/kenney_top-down-shooter/Tilesheet/tilesheet_complete.png';

/**
 * Player and enemy art. A typed bundle gives compile-checked keys —
 * `characters.get('player')` is valid, a typo is a TypeScript error rather than
 * a runtime surprise when the object first spawns.
 */
export const characters = defineAssetBundle('characters', {
  player: playerUrl,
  zombie: zombieUrl,
});

/**
 * Terrain fills — its own namespace so the ground/building art can be loaded
 * and unloaded independently of the characters as the demo grows.
 */
export const terrain = defineAssetBundle('terrain', {
  grass: grassUrl,
  floorWood: floorWoodUrl,
});

/**
 * The shared object atlas. A single image backs every prop and furniture
 * sprite; `tiles.ts` turns named regions of it into {@link Texture}s. Loading
 * one atlas instead of dozens of individual files is both faster to fetch and
 * the only way to render the art's genuinely multi-tile objects whole.
 */
export const tilesheet = defineAssetBundle('tilesheet', {
  sheet: tilesheetUrl,
});
