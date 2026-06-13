import { TilingSprite as PixiTilingSprite } from 'pixi.js';
import { Point } from '../geometry';
import { WorldObject } from '../world';
import { AbstractTexturedGraphics } from './abstract-textured-graphics';
import type { TilingSpriteOptions } from './tiling-sprite.types';
import { Texture } from './texture';

/**
 * Renders a {@link Texture} repeated across a rectangular region attached to a
 * {@link WorldObject} — the building block for tiled floors, walls, and
 * scrolling backgrounds.
 *
 * Where a {@link Sprite} draws one copy of a texture, a `TilingSprite` fills a
 * `width` x `height` region by repeating its texture as many times as needed.
 * It builds on {@link AbstractGraphics}, so it inherits scene-parenting and
 * the once-per-frame transform sync (position, rotation, and the host's
 * `scale`).
 *
 * ## Region size vs. tile size
 *
 * Two independent levers, neither of which fights the inherited
 * transform sync:
 *
 * - {@link TilingSprite.width} / {@link TilingSprite.height} — the size of the
 *   region to fill, in world units. Changing these adds or removes repeats.
 * - {@link TilingSprite.setTileScale} — the on-screen size of each repeated
 *   tile. This is how you draw 16px pixel-art tiles at, say, 3x without
 *   changing the region. The host's {@link WorldObject.scale} still scales the
 *   whole thing on top, as with any graphics component.
 *
 * ## Scrolling
 *
 * {@link TilingSprite.setTileOffset} shifts the tiling pattern within the
 * region; animate it each tick for a parallax/scrolling background.
 *
 * @example
 * ```ts
 * // A 2000x2000 floor of a 16px tile drawn at 3x, centred on the object.
 * const floor = world.createObject();
 * const tile = new Texture(tileset, { x: 16, y: 16, width: 16, height: 16 });
 * floor.addComponentFromFactory(
 *   'floor',
 *   (host) =>
 *     new TilingSprite(host, tile, {
 *       width: 2000,
 *       height: 2000,
 *       tileScale: 3,
 *     }),
 * );
 * ```
 *
 * @see {@link Texture} for the drawable that gets repeated.
 * @see {@link Sprite} for the single-copy counterpart.
 */
export class TilingSprite extends AbstractTexturedGraphics<PixiTilingSprite> {
  private _texture: Texture;

  /**
   * @param host The {@link WorldObject} this tiling sprite is attached to.
   * @param texture The {@link Texture} to repeat across the region.
   * @param options {@link TilingSpriteOptions}. `width` and `height` are
   * required; the rest default as documented.
   */
  constructor(
    host: WorldObject,
    texture: Texture,
    options: TilingSpriteOptions,
  ) {
    const display = new PixiTilingSprite({
      texture: texture.raw,
      width: options.width,
      height: options.height,
    });

    const tileScale = options.tileScale ?? 1;
    if (typeof tileScale === 'number') {
      display.tileScale.set(tileScale, tileScale);
    } else {
      display.tileScale.set(tileScale.x, tileScale.y);
    }

    if (options.tileOffset) {
      display.tilePosition.set(options.tileOffset.x, options.tileOffset.y);
    }

    // anchor/tint/alpha/visible are applied by AbstractTexturedGraphics.
    super(host, display, options);

    this._texture = texture;
  }

  /**
   * The {@link Texture} this tiling sprite repeats.
   */
  public get texture(): Texture {
    return this._texture;
  }

  /**
   * Swaps the repeated {@link Texture}. The previous texture is left intact —
   * lifetime belongs to the owning {@link ImageAsset}.
   *
   * @param texture The texture to repeat from now on.
   */
  public setTexture(texture: Texture): void {
    this._texture = texture;
    this.raw.texture = texture.raw;
  }

  /**
   * The width of the tiled region in world units. Setting it changes how many
   * times the texture repeats horizontally; it does not scale the tiles (use
   * {@link TilingSprite.setTileScale}) or fight the host transform.
   */
  public get width(): number {
    return this.raw.width;
  }

  public set width(value: number) {
    this.raw.width = value;
  }

  /**
   * The height of the tiled region in world units. See
   * {@link TilingSprite.width}.
   */
  public get height(): number {
    return this.raw.height;
  }

  public set height(value: number) {
    this.raw.height = value;
  }

  /**
   * The per-tile scale as a fresh `Readonly` {@link Point}. Returned by
   * value so mutating it is inert (and now a compile error); use
   * {@link TilingSprite.setTileScale} to change it.
   */
  public get tileScale(): Readonly<Point> {
    return new Point(this.raw.tileScale.x, this.raw.tileScale.y);
  }

  /**
   * Sets the on-screen scale of each repeated tile, independent of the region
   * size and the host transform.
   *
   * @param x The horizontal tile scale.
   * @param y The vertical tile scale. Defaults to `x`.
   */
  public setTileScale(x: number, y: number = x): void {
    this.raw.tileScale.set(x, y);
  }

  /**
   * The current tiling-pattern offset as a fresh `Readonly` {@link Point}.
   * Returned by value so mutating it is inert (and now a compile error); use
   * {@link TilingSprite.setTileOffset} to change it.
   */
  public get tileOffset(): Readonly<Point> {
    return new Point(this.raw.tilePosition.x, this.raw.tilePosition.y);
  }

  /**
   * Shifts the tiling pattern within the region — animate this for a
   * scrolling background.
   *
   * @param x The horizontal offset in pre-tileScale texture pixels.
   * @param y The vertical offset.
   */
  public setTileOffset(x: number, y: number): void {
    this.raw.tilePosition.set(x, y);
  }
}
