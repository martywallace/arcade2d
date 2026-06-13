/**
 * Shared tuning for the RPG demo. Centralised so the gameplay feel can be
 * adjusted in one place, and so the map builder and the prefabs agree on the
 * pixel grid.
 */

/** Edge length of one source tile, in world pixels. The Kenney art is 64px. */
export const TILE = 64;

/**
 * Edge length of the square tiled ground, in world pixels. The playable area is
 * this centred on the origin, so valid world coordinates run from
 * `-WORLD_HALF` to `+WORLD_HALF` on both axes. The ground sprite, the player
 * clamp, and the camera clamp all derive their bounds from this one value.
 */
export const WORLD_SIZE = 8000;

/** Half {@link WORLD_SIZE}: the world extends `±WORLD_HALF` from the origin. */
export const WORLD_HALF = WORLD_SIZE / 2;

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

// --- Camera -----------------------------------------------------------------

/**
 * How far the camera leads from the player toward the mouse, as a fraction of
 * the player→cursor vector. A small lead nudges the view slightly toward where
 * you're aiming without yanking the player off-centre; `0.12` keeps the player
 * near the middle and just hints at the world ahead.
 */
export const CAMERA_LOOK_AHEAD = 0.12;

/**
 * Exponential smoothing rate for the camera ease, in "per second". Higher is
 * snappier; the camera closes ~63% of the remaining gap every `1 / rate`
 * seconds. Applied frame-rate-independently via the frame delta.
 */
export const CAMERA_EASE_RATE = 6;

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

/**
 * How fast a zombie turns toward a new heading, in radians per second. The
 * pathfinder can hand back a sharply different direction from one frame to the
 * next (the flow field steers in 45-degree steps); easing the facing at this
 * capped rate makes the zombie sweep into the turn instead of snapping. Set so
 * a full 180-degree about-face takes ~200ms (`PI / 0.2`), which still reads as
 * quick without being jarring.
 */
export const ZOMBIE_TURN_RATE = Math.PI / 0.2;

// --- Spawners --------------------------------------------------------------

export const SPAWNER_CAP = 8; // live zombies a spawn point maintains
export const SPAWN_INTERVAL = 2600; // ms between respawns once below the cap
export const SPAWN_JITTER = 120; // px of scatter around a spawn point

// --- Navigation (zombie flow field) ----------------------------------------

/**
 * Cell size of the zombie navigation grid, in world pixels. Kept below the
 * thinnest wall (the houses are one 64px tile thick) so a wall can't slip
 * between two cell centres and leave a phantom gap in the field; smaller still
 * would thread tighter but costs more to flood each retarget.
 */
export const FLOW_CELL = 40;

/**
 * Clearance used when marking grid cells blocked: a cell is impassable if a
 * static collider sits within this distance of its centre. Set to the zombie
 * radius plus a margin so the routed path keeps bodies off obstacle corners
 * instead of scraping along them.
 */
export const FLOW_CLEARANCE = ZOMBIE_RADIUS + 8;
