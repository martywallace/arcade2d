/**
 * Shared tuning for the RPG demo. Centralised so the gameplay feel can be
 * adjusted in one place, and so the map builder and the prefabs agree on the
 * pixel grid.
 */

/** Edge length of one source tile, in world pixels. The Kenney art is 64px. */
export const TILE = 64;

/**
 * Display scale for the character sprites (~38px source art), nudged up so
 * they read at roughly two-thirds of a tile, matching the sample scene.
 */
export const CHARACTER_SCALE = 1.1;

/** Tags used across the demo for {@link World.findByTag} and collision checks. */
export const TAG = {
  player: 'player',
  enemy: 'enemy',
  bullet: 'bullet',
  structure: 'structure',
} as const;

// --- Player ----------------------------------------------------------------

export const PLAYER_SPEED = 230; // px/s
export const PLAYER_RADIUS = 18; // collider radius, px
export const PLAYER_FIRE_INTERVAL = 170; // ms between shots
export const PLAYER_FIRE_SPREAD = 0.05; // radians of random aim jitter
export const PLAYER_HEALTH = 20; // hit points before a (full-health) respawn

// --- Bullets ---------------------------------------------------------------

export const BULLET_SPEED = 760; // px/s
export const BULLET_RADIUS = 5; // sensor radius, px
export const BULLET_LIFETIME = 1100; // ms before a bullet that hits nothing dies
export const BULLET_DAMAGE = 1;

// --- Zombies ---------------------------------------------------------------

export const ZOMBIE_SPEED = 68; // px/s
export const ZOMBIE_RADIUS = 16; // collider radius, px
export const ZOMBIE_HEALTH = 3; // bullet hits to kill
export const ZOMBIE_DAMAGE = 1; // hit points removed per bite
export const ZOMBIE_ATTACK_INTERVAL = 800; // ms between bites while in contact

// --- Spawners --------------------------------------------------------------

export const SPAWNER_CAP = 3; // live zombies a spawn point maintains
export const SPAWN_INTERVAL = 2600; // ms between respawns once below the cap
export const SPAWN_JITTER = 48; // px of scatter around a spawn point
