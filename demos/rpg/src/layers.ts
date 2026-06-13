import { defineLayers } from '@arcade2d/engine';

/**
 * The demo's render layers, declared back-to-front. The world is created with
 * this set, so every graphics component in the scene must name one of these — a
 * graphic that omits a layer throws at spawn (see {@link defineLayers}).
 *
 * - `ground` — the grass field, the wood floors inside buildings, and flat decor
 *   the player walks over (rugs).
 * - `characters` — the player, zombies, and bullets.
 * - `structures` — walls, solid furniture, trees, and scattered props. Drawn
 *   above characters so the player passes *under* a tree's canopy edge and
 *   behind walls.
 * - `ui` — the HUD and the floating enemy health bars, always on top.
 */
export const layers = defineLayers('ground', 'characters', 'structures', 'ui');
