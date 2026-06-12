import type { PointPrimitive } from '@arcade2d/engine';
import { AbstractWorldComponent, PhysicsWorld } from '@arcade2d/engine';
import {
  FLOW_CELL,
  FLOW_CLEARANCE,
  TAG,
  WORLD_HALF,
  WORLD_SIZE,
} from '../constants';

/** The eight grid moves, as `[columnDelta, rowDelta]`. */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Shared zombie navigation built as a **flow field** (a Dijkstra/BFS distance
 * map) over the static world, so the whole horde can route around the houses
 * and props instead of grinding straight into a wall.
 *
 * ## Why a flow field, and how it relates to the physics
 *
 * Pathfinding and physics are separate layers. The physics solver never
 * pathfinds — it only resolves collisions (sliding a body along an angled wall,
 * pushing stacked zombies apart). This component answers the *other* question —
 * "which way should a zombie head from where it stands?" — and hands the result
 * to {@link ZombieController}, which feeds it to the body as a velocity. The
 * solver still does the final, frame-by-frame collision resolution underneath.
 *
 * Every zombie chases the *same* target (the player), so one shared field beats
 * a per-agent A\* search: it is built once per retarget and read in O(1) by each
 * zombie. The pipeline is:
 *
 * 1. **Rasterize** the static colliders into a blocked grid, once. Each *fixed*
 *    collider is walked via {@link PhysicsWorld.raw} and the cells inside its
 *    bounding box are tested against the collider's own shape, so the rotated
 *    house walls are picked up exactly as the solver sees them — no separate
 *    obstacle list to keep in sync. Cells within {@link FLOW_CLEARANCE} of an
 *    obstacle are marked impassable so routed paths keep bodies off corners.
 * 2. **Flood** a breadth-first distance field outward from the player's cell,
 *    rebuilt only when the player crosses into a new cell.
 * 3. **Follow** the field: {@link FlowField.directionAt} returns the downhill
 *    direction toward the player for any world position.
 *
 * {@link FlowField.hasClearPath} is the companion query: a grid line-of-sight
 * test the controller uses to seek the player *directly* (smoothly) when nothing
 * is in the way, falling back to the field only when a wall intervenes.
 *
 * The grid covers the playable {@link WORLD_SIZE} square centred on the origin.
 * Attach one per {@link World} alongside {@link PhysicsWorld}.
 */
export class FlowField extends AbstractWorldComponent {
  private readonly _cols = Math.ceil(WORLD_SIZE / FLOW_CELL);
  private readonly _rows = this._cols;

  /** `1` where a static collider blocks the cell, `0` where it is walkable. */
  private readonly _blocked = new Uint8Array(this._cols * this._rows);

  /** BFS distance (in cells) from the player's cell; `-1` means unreached. */
  private readonly _dist = new Int32Array(this._cols * this._rows);

  /** Scratch queue for the flood; each cell is enqueued at most once. */
  private readonly _queue = new Int32Array(this._cols * this._rows);

  private _rasterized = false;
  private _targetCell = -1;

  public override onUpdate(): void {
    // Rasterize lazily on the first tick: the map (and therefore the static
    // colliders) is built after the world, so the grid can't be probed at
    // construction time.
    if (!this._rasterized) {
      this._rasterize();
    }

    const player = this.world.findOneByTag(TAG.player);

    if (!player) {
      return;
    }

    // Reflood only when the player has moved to a different cell — the field is
    // identical for every position within one cell.
    const target = this._cellIndex(player.position.x, player.position.y);

    if (target !== this._targetCell) {
      this._targetCell = target;
      this._flood(target);
    }
  }

  /**
   * The unit direction a zombie at `position` should head to make progress
   * toward the player along the field — the step to the lowest-distance
   * walkable neighbour. Returns `null` when the field has nothing to offer
   * (not yet built, or the cell is the player's own), in which case the caller
   * should seek the player directly.
   */
  public directionAt(position: PointPrimitive): PointPrimitive | null {
    if (!this._rasterized) {
      return null;
    }

    const col = this._clampCol(position.x);
    const row = this._clampRow(position.y);
    const here = this._dist[this._index(col, row)];

    // If the zombie is sitting in an unreached cell (e.g. wedged in the
    // clearance band against a wall), treat its own distance as infinite so any
    // reachable neighbour wins and pulls it back toward open ground.
    let bestDistance = here >= 0 ? here : Number.POSITIVE_INFINITY;
    let bestCol = -1;
    let bestRow = -1;

    for (const [dc, dr] of NEIGHBOURS) {
      const nc = col + dc;
      const nr = row + dr;

      if (!this._inBounds(nc, nr) || this._isBlocked(nc, nr)) {
        continue;
      }

      // Don't cut a diagonal between two obstacles whose corners touch.
      if (
        dc !== 0 &&
        dr !== 0 &&
        (this._isBlocked(nc, row) || this._isBlocked(col, nr))
      ) {
        continue;
      }

      const distance = this._dist[this._index(nc, nr)];

      if (distance >= 0 && distance < bestDistance) {
        bestDistance = distance;
        bestCol = nc;
        bestRow = nr;
      }
    }

    if (bestCol < 0) {
      return null;
    }

    const dx = bestCol - col;
    const dy = bestRow - row;
    const length = Math.hypot(dx, dy);

    return { x: dx / length, y: dy / length };
  }

  /**
   * Grid line-of-sight: `true` if the straight segment from `from` to `to`
   * crosses no blocked cell, so a zombie can make a beeline rather than follow
   * the field. The endpoints are skipped so a target hugging a wall (whose own
   * cell sits in the clearance band) doesn't read as occluded.
   *
   * Conservative by construction: the blocked cells are inflated by
   * {@link FLOW_CLEARANCE}, so a "clear" path has room for the zombie's body.
   */
  public hasClearPath(from: PointPrimitive, to: PointPrimitive): boolean {
    if (!this._rasterized) {
      return true;
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(dx, dy) / (FLOW_CELL * 0.5)),
    );

    for (let i = 1; i < steps; i++) {
      const x = from.x + (dx * i) / steps;
      const y = from.y + (dy * i) / steps;

      if (this._isBlocked(this._clampCol(x), this._clampRow(y))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Stamps `_blocked` from the static colliders. Iterates each *fixed* collider
   * and marks the cells inside its bounding box — far cheaper than probing all
   * cells, and it avoids the world-level spatial query (Rapier 0.19 ships no
   * query pipeline here, so `world.projectPoint` traps). Each candidate cell is
   * tested against the collider's own shape with the per-collider `projectPoint`,
   * which respects the wall's real rotation — so the field routes around the
   * angled houses exactly as the solver collides with them.
   */
  private _rasterize(): void {
    const world = this.world.getComponentByType(PhysicsWorld).raw;

    world.forEachCollider((collider) => {
      const body = collider.parent();

      // Only fixed bodies are obstacles; dynamic zombies/bullets/the player must
      // not carve moving holes into the field.
      if (body === null || !body.isFixed()) {
        return;
      }

      const centre = collider.translation();
      // halfExtents() is non-null for cuboids (walls, crates) and null for balls
      // (trees, rocks), which report a radius() instead.
      const extents: { x: number; y: number } | null = collider.halfExtents();
      const boundingRadius = extents
        ? Math.hypot(extents.x, extents.y)
        : collider.radius();

      // Pad the search box by the clearance and a cell so boundary cells aren't
      // missed; cells outside the box can't be within clearance of this shape.
      const reach = boundingRadius + FLOW_CLEARANCE + FLOW_CELL;
      const colMin = this._clampCol(centre.x - reach);
      const colMax = this._clampCol(centre.x + reach);
      const rowMin = this._clampRow(centre.y - reach);
      const rowMax = this._clampRow(centre.y + reach);

      for (let row = rowMin; row <= rowMax; row++) {
        for (let col = colMin; col <= colMax; col++) {
          const index = this._index(col, row);

          if (this._blocked[index]) {
            continue;
          }

          const x = this._cellCentre(col);
          const y = this._cellCentre(row);
          const hit = collider.projectPoint({ x, y }, true);

          if (
            hit &&
            (hit.isInside ||
              Math.hypot(x - hit.point.x, y - hit.point.y) < FLOW_CLEARANCE)
          ) {
            this._blocked[index] = 1;
          }
        }
      }
    });

    this._rasterized = true;
  }

  /** Breadth-first flood of `_dist` outward from `target` over walkable cells. */
  private _flood(target: number): void {
    this._dist.fill(-1);

    // The player can stand in the clearance band next to a wall; flood from the
    // nearest walkable cell instead so the field still has a source.
    const source = this._blocked[target]
      ? this._nearestWalkable(target)
      : target;

    if (source < 0) {
      return;
    }

    const queue = this._queue;
    let head = 0;
    let tail = 0;

    this._dist[source] = 0;
    queue[tail++] = source;

    while (head < tail) {
      const current = queue[head++];
      const col = current % this._cols;
      const row = (current - col) / this._cols;
      const next = this._dist[current] + 1;

      for (const [dc, dr] of NEIGHBOURS) {
        const nc = col + dc;
        const nr = row + dr;

        if (!this._inBounds(nc, nr) || this._isBlocked(nc, nr)) {
          continue;
        }

        if (
          dc !== 0 &&
          dr !== 0 &&
          (this._isBlocked(nc, row) || this._isBlocked(col, nr))
        ) {
          continue;
        }

        const index = this._index(nc, nr);

        if (this._dist[index] < 0) {
          this._dist[index] = next;
          queue[tail++] = index;
        }
      }
    }
  }

  /** Nearest walkable cell to `from` by expanding Chebyshev rings; `-1` if none. */
  private _nearestWalkable(from: number): number {
    const col = from % this._cols;
    const row = (from - col) / this._cols;

    for (let radius = 1; radius < this._cols; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          // Only the ring's perimeter is new at this radius.
          if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) {
            continue;
          }

          const nc = col + dc;
          const nr = row + dr;

          if (this._inBounds(nc, nr) && !this._isBlocked(nc, nr)) {
            return this._index(nc, nr);
          }
        }
      }
    }

    return -1;
  }

  private _isBlocked(col: number, row: number): boolean {
    return this._blocked[this._index(col, row)] === 1;
  }

  private _inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this._cols && row >= 0 && row < this._rows;
  }

  private _index(col: number, row: number): number {
    return row * this._cols + col;
  }

  /** Cell index for a world coordinate pair, clamped to the grid. */
  private _cellIndex(x: number, y: number): number {
    return this._index(this._clampCol(x), this._clampRow(y));
  }

  private _clampCol(x: number): number {
    return Math.min(
      this._cols - 1,
      Math.max(0, Math.floor((x + WORLD_HALF) / FLOW_CELL)),
    );
  }

  private _clampRow(y: number): number {
    return Math.min(
      this._rows - 1,
      Math.max(0, Math.floor((y + WORLD_HALF) / FLOW_CELL)),
    );
  }

  /** World-space centre of the given column or row index. */
  private _cellCentre(index: number): number {
    return -WORLD_HALF + (index + 0.5) * FLOW_CELL;
  }
}
