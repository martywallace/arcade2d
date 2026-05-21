import { defineAssetBundle } from '@arcade2d/engine';
import zombieUrl from '../assets/Character_animation/monsters_idle/skeleton1/v1/skeleton_v1_1.png';
import playerUrl from '../assets/Character_animation/priests_idle/priest1/v1/priest1_v1_1.png';
import tilesetUrl from '../assets/character and tileset/Dungeon_Tileset.png';

/**
 * The character art the game renders. Declaring it as a typed bundle gives
 * compile-time-checked keys: `characters.get('player')` is valid,
 * `characters.get('plyer')` is a TypeScript error rather than a runtime
 * surprise when an object first spawns.
 *
 * Paths are Vite asset-URL imports, so the bundler fingerprints and serves
 * the files; the values are plain URL strings the engine's loader resolves.
 */
export const characters = defineAssetBundle('characters', {
  player: playerUrl,
  zombie: zombieUrl,
});

/**
 * Environment art — its own bundle (and namespace) so the scenery can be
 * loaded and unloaded independently of the characters as the demo grows into
 * multiple rooms/levels.
 */
export const scenery = defineAssetBundle('scenery', {
  tileset: tilesetUrl,
});

/**
 * Display scale applied to the 16x16 pixel-art frames so they read at a
 * playable size on screen. Reused as the floor's tile scale so tiles and
 * characters share a pixel grid.
 */
export const CHARACTER_SCALE = 3;

/**
 * Source-pixel frame of a plain floor tile within the 16x16 dungeon tileset.
 */
export const FLOOR_TILE_FRAME = {
  x: 16,
  y: 16,
  width: 16,
  height: 16,
} as const;
