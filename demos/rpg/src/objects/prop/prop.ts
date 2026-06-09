import type { PointPrimitive, World, WorldObject } from '@arcade2d/engine';
import {
  Circle,
  ImageAsset,
  RigidBody,
  Sprite,
  Texture,
} from '@arcade2d/engine';
import type { PropKey } from '../../assets';
import { props } from '../../assets';
import { TAG } from '../../constants';

/** Options for {@link createProp}. */
interface PropOptions {
  /**
   * When set, the prop gets a circular `fixed` collider of this radius (px) and
   * is tagged `structure`, so the player, zombies, and bullets all treat it as
   * solid. Omit for purely decorative props.
   */
  readonly colliderRadius?: number;
}

/**
 * Places a single outdoor prop (tree, hedge, rock) at a world position.
 *
 * Props are top-level objects — not nested under anything — so a solid prop's
 * collider sits exactly under its sprite. Trees and hedges block movement and
 * stop bullets; rocks are usually left decorative.
 *
 * @param world The world to spawn into.
 * @param position Where the prop sits, in world pixels.
 * @param key Which prop art to use — a key of the {@link props} bundle.
 * @param options Collider configuration. See {@link PropOptions}.
 * @returns The prop object.
 */
export function createProp(
  world: World,
  position: PointPrimitive,
  key: PropKey,
  options: PropOptions = {},
): WorldObject {
  const texture = new Texture(
    world.game.assets.use(props).getAs(key, ImageAsset),
  );
  const radius = options.colliderRadius;
  const prop = world.createEmpty(
    position,
    radius !== undefined ? [TAG.structure] : [],
  );

  prop.addComponentsFromFactories({
    graphics: (object) => new Sprite(object, texture),
  });

  if (radius !== undefined) {
    prop.addComponentsFromFactories({
      body: (object) =>
        new RigidBody(object, {
          type: 'fixed',
          collider: { shape: new Circle(radius) },
        }),
    });
  }

  return prop;
}
