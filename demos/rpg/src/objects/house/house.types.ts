import type { PointPrimitive } from '@arcade2d/engine';
import type { TileKey } from '../../tiles';

/**
 * One piece of furniture placed inside a house, positioned on the interior tile
 * grid relative to the house centre.
 */
export interface FurniturePiece {
  /** Which atlas region to draw — a key of {@link TILE_FRAMES}. */
  readonly key: TileKey;

  /** Column offset from the house centre, in tiles (may be fractional). */
  readonly tx: number;

  /** Row offset from the house centre, in tiles (may be fractional). */
  readonly ty: number;

  /**
   * When `true`, the piece contributes a collider to the house body so the
   * player and zombies bump into it. Decorative pieces (rugs, plants) leave
   * this `false`.
   */
  readonly collide?: boolean;

  /** Optional sprite rotation, in radians, for visual variety. */
  readonly rotation?: number;
}

/**
 * Describes one house for {@link createHouse}: where it sits, how big its
 * interior is, and what furniture goes inside. A doorway gap is always left in
 * the middle of the south wall so the player can walk in.
 */
export interface HouseConfig {
  /** World-space centre of the house, in pixels. */
  readonly center: PointPrimitive;

  /** Interior width, in tiles (excludes the surrounding wall ring). */
  readonly tilesW: number;

  /** Interior height, in tiles. */
  readonly tilesH: number;

  /**
   * Rotation of the whole building, in radians. The root carries it, so the
   * walls, floor, furniture, *and* the compound collider all turn as one rigid
   * unit — an angled house is blocked along its real angled walls, not an
   * axis-aligned box. Defaults to `0`.
   */
  readonly rotation?: number;

  /** Furniture to place inside. */
  readonly furniture?: readonly FurniturePiece[];
}
