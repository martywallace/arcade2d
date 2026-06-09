import { defineAssetBundle } from '@arcade2d/engine';

// Characters (Kenney Topdown Shooter, CC0). The sprites face east (+x), which
// matches the engine's rotation=0 convention, so a facing angle maps straight
// onto `host.rotation` with no offset.
import playerUrl from '../assets/kenney_top-down-shooter/PNG/Survivor 1/survivor1_gun.png';
import zombieUrl from '../assets/kenney_top-down-shooter/PNG/Zombie 1/zoimbie1_hold.png';

// Terrain tiles, used as tiled fills (grass ground, wood floors, walls).
import grassUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_01.png';
import floorWoodUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_42.png';
import wallUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_124.png';

// Outdoor props.
import treeUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_181.png';
import treeAutumnUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_184.png';
import hedgeUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_208.png';
import rockUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_237.png';

// Interior furniture.
import sofaGreenUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_450.png';
import sofaOrangeUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_474.png';
import chairBlueUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_451.png';
import tableRoundUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_132.png';
import tableOrangeUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_345.png';
import bedUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_399.png';
import crateUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_129.png';
import rugUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_131.png';
import plantUrl from '../assets/kenney_top-down-shooter/PNG/Tiles/tile_134.png';

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
  wall: wallUrl,
});

/**
 * Outdoor scenery props scattered across the grass.
 */
export const props = defineAssetBundle('props', {
  tree: treeUrl,
  treeAutumn: treeAutumnUrl,
  hedge: hedgeUrl,
  rock: rockUrl,
});

/** The keys of the {@link props} bundle. */
export type PropKey = 'tree' | 'treeAutumn' | 'hedge' | 'rock';

/**
 * Indoor furniture placed inside the houses.
 */
export const furniture = defineAssetBundle('furniture', {
  sofaGreen: sofaGreenUrl,
  sofaOrange: sofaOrangeUrl,
  chairBlue: chairBlueUrl,
  tableRound: tableRoundUrl,
  tableOrange: tableOrangeUrl,
  bed: bedUrl,
  crate: crateUrl,
  rug: rugUrl,
  plant: plantUrl,
});

/** The keys of the {@link furniture} bundle — names a house layout can place. */
export type FurnitureKey =
  | 'sofaGreen'
  | 'sofaOrange'
  | 'chairBlue'
  | 'tableRound'
  | 'tableOrange'
  | 'bed'
  | 'crate'
  | 'rug'
  | 'plant';
