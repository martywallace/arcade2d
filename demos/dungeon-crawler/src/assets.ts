import { defineAssetBundle } from '@arcade2d/engine';
import zombieUrl from '../assets/Character_animation/monsters_idle/skeleton1/v2/skeleton_v2_1.png';
import playerUrl from '../assets/Character_animation/priests_idle/priest1/v1/priest1_v1_1.png';
import tilesetUrl from '../assets/character and tileset/Dungeon_Tileset.png';
import arrowUrl from '../assets/items and trap_animation/arrow/Just_arrow.png';
import coin1Url from '../assets/items and trap_animation/coin/coin_1.png';
import coin2Url from '../assets/items and trap_animation/coin/coin_2.png';
import coin3Url from '../assets/items and trap_animation/coin/coin_3.png';
import coin4Url from '../assets/items and trap_animation/coin/coin_4.png';

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
 * Projectile art — the player's arrow. Its own bundle so weapon/projectile
 * assets can grow independently of the characters and scenery.
 */
export const projectiles = defineAssetBundle('projectiles', {
  arrow: arrowUrl,
});

/**
 * Pickup art. The coin is a four-frame spin animation supplied as separate
 * files (one per frame) rather than a strip, so each frame is its own bundle
 * key; the coin prefab turns them into an ordered {@link AnimatedSprite}.
 */
export const items = defineAssetBundle('items', {
  coin1: coin1Url,
  coin2: coin2Url,
  coin3: coin3Url,
  coin4: coin4Url,
});

/**
 * The coin animation frame keys, in spin order, so the prefab and any UI can
 * iterate them without restating the literal list.
 */
export const COIN_FRAME_KEYS = ['coin1', 'coin2', 'coin3', 'coin4'] as const;

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
