import type { PointPrimitive, World, WorldObject } from '@arcade2d/engine';
import { Circle, Rectangle, RigidBody, Sprite } from '@arcade2d/engine';
import { TAG } from '../../constants';
import type { TileKey } from '../../tiles';
import { tileTexture } from '../../tiles';

/**
 * A prop's collider, in its own local space. A `circle` suits round canopies and
 * boulders; a `box` suits long straight things (a fallen log, a crate) and
 * rotates with the prop, so an angled log is blocked along its real outline —
 * the same rotated-collider physics the angled houses show off.
 */
export type PropCollider =
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'box'; readonly width: number; readonly height: number };

/** Options for {@link createProp}. */
export interface PropOptions {
  /**
   * When set, the prop gets a `fixed` collider of this shape and is tagged
   * `structure`, so the player, zombies, and bullets all treat it as solid.
   * Omit for purely decorative props (small bushes, ground clutter).
   */
  readonly collider?: PropCollider;

  /**
   * Sprite-and-collider rotation, in radians. Seeded onto the body before it is
   * built, so a `box` collider lands rotated to match the art rather than
   * axis-aligned under a tilted sprite.
   */
  readonly rotation?: number;
}

/**
 * Places a single outdoor prop (tree, bush, rock, log, crate) at a world
 * position.
 *
 * Props are top-level objects — not nested under anything — so a solid prop's
 * collider sits exactly under its sprite. Trees, rocks, logs, and crates block
 * movement and stop bullets; small bushes and ground clutter are left
 * decorative.
 *
 * @param world The world to spawn into.
 * @param position Where the prop sits, in world pixels.
 * @param key Which atlas region to draw — a key of {@link TILE_FRAMES}.
 * @param options Collider and rotation. See {@link PropOptions}.
 * @returns The prop object.
 */
export function createProp(
  world: World,
  position: PointPrimitive,
  key: TileKey,
  options: PropOptions = {},
): WorldObject {
  const texture = tileTexture(world.game.assets, key);
  const { collider, rotation } = options;
  const prop = world.createEmpty(position, collider ? [TAG.structure] : []);

  // Seed rotation before the body is built so a fixed body reads it once and a
  // box collider is created already rotated (RigidBody seeds from the host
  // transform at attach time and never moves a fixed body again).
  prop.rotation = rotation ?? 0;

  prop.addComponentsFromFactories({
    graphics: (object) => new Sprite(object, texture),
  });

  if (collider) {
    const shape =
      collider.kind === 'circle'
        ? new Circle(collider.radius)
        : new Rectangle(collider.width, collider.height);

    prop.addComponentsFromFactories({
      body: (object) =>
        new RigidBody(object, { type: 'fixed', collider: { shape } }),
    });
  }

  return prop;
}
