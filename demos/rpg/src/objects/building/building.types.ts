import type { PointPrimitive } from '@arcade2d/engine';
import type { TileKey } from '../../tiles';

/**
 * One piece of furniture placed inside a building, positioned on the same cell
 * grid as its {@link BuildingConfig.plan} (so picking a spot is "which cell of
 * which room"). Coordinates may be fractional to sit a piece between cells.
 */
export interface BuildingFurniture {
  /** Which atlas region to draw — a key of {@link TILE_FRAMES}. */
  readonly key: TileKey;

  /** Column on the plan grid, `0` at the left edge (may be fractional). */
  readonly col: number;

  /** Row on the plan grid, `0` at the top edge (may be fractional). */
  readonly row: number;

  /**
   * When `true`, the piece contributes a collider to the building body so the
   * player and zombies bump into it. Decorative pieces (rugs, plants) leave this
   * `false`.
   */
  readonly collide?: boolean;

  /** Optional sprite rotation, in radians, for visual variety. */
  readonly rotation?: number;

  /**
   * When `true`, the piece is flat floor decor (a rug) and renders on the
   * `ground` layer, *under* characters, so the player and zombies walk over it.
   * Solid furniture leaves this `false` and renders on `structures`, above
   * characters.
   */
  readonly floor?: boolean;
}

/**
 * Describes a multi-room building for {@link createBuilding}.
 *
 * The floorplan is given as {@link BuildingConfig.plan}: a list of equal-length
 * rows of characters, one per cell, where `#` is a wall and any other character
 * (conventionally `.`) is open floor. Walls are autotiled from their neighbours,
 * so corners, T-junctions where interior walls meet, and the capped ends that
 * frame a doorway all fall out of the layout — a doorway is simply a run of
 * floor cells left in a wall line. The whole grid is centred on
 * {@link BuildingConfig.center}.
 */
export interface BuildingConfig {
  /** World-space centre of the building, in pixels. */
  readonly center: PointPrimitive;

  /**
   * The floorplan, one string per grid row. Every row must be the same length.
   * `#` marks a wall cell; every other character is floor (rooms, the hallway,
   * and the doorway gaps left in wall lines).
   */
  readonly plan: readonly string[];

  /**
   * Rotation of the whole building, in radians. The root carries it, so the
   * walls, floor, furniture, *and* the compound collider all turn as one rigid
   * unit — angled walls are collided along their real angle, not an axis-aligned
   * box. Defaults to `0`.
   */
  readonly rotation?: number;

  /** Furniture to place inside. */
  readonly furniture?: readonly BuildingFurniture[];
}
