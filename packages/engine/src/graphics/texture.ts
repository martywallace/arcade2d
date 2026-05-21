import { Rectangle as PixiRectangle, Texture as PixiTexture } from 'pixi.js';
import { ImageAsset } from '../assets';
import type { TextureFrame, TextureGridOptions } from './texture.types';

/**
 * A drawable view onto an {@link ImageAsset} — *what* to draw, as distinct
 * from the {@link Sprite} component that decides *where* to draw it.
 *
 * A `Texture` is either the whole of an image or a rectangular sub-region of
 * it (a {@link TextureFrame}). Sub-region textures are how spritesheets,
 * tilesets, and animation strips work: many `Texture`s share one image's GPU
 * source, each sampling a different frame. This mirrors the renderer's own
 * model, where frame selection lives on the texture, not on the sprite.
 *
 * `Texture` is a lightweight, **positionless, shareable value** — it holds no
 * {@link WorldObject} and no transform. Construct it once (typically at
 * asset-load or prefab-registration time) and hand the same instance to as
 * many {@link Sprite}s as you like. A future animated sprite cycles through a
 * `Texture[]` produced by {@link Texture.grid}.
 *
 * ## Lifetime
 *
 * A `Texture`'s pixels are owned by its {@link ImageAsset}, which in turn is
 * owned by the {@link AssetLibrary}. Unloading the asset (e.g. via
 * {@link AssetLibrary.unloadNamespace}) frees the underlying GPU source and
 * invalidates every `Texture` derived from it. A `Texture` therefore does not
 * need — and does not provide — its own `destroy`; manage lifetime at the
 * asset/namespace level.
 *
 * @example
 * ```ts
 * const sheet = game.assets.get('player') as ImageAsset;
 *
 * // Whole image.
 * const full = new Texture(sheet);
 *
 * // A single 16x16 cell at column 2, row 0 of a spritesheet.
 * const frame = new Texture(sheet, { x: 32, y: 0, width: 16, height: 16 });
 *
 * // Every frame of a 4-column walk strip, in order.
 * const walk = Texture.grid(sheet, {
 *   frameWidth: 16,
 *   frameHeight: 16,
 *   columns: 4,
 *   rows: 1,
 * });
 * ```
 *
 * @see {@link ImageAsset} for the loaded image a texture views.
 * @see {@link Sprite} for the component that renders a texture.
 */
export class Texture {
  /**
   * Slices a regular grid of equally-sized frames out of one image and
   * returns a {@link Texture} per cell, in **row-major order** — left to
   * right across each row, then top to bottom. The standard way to turn a
   * tileset or animation strip into addressable frames.
   *
   * @param asset The image to slice.
   * @param options Grid layout — cell size, column/row counts, and optional
   * offset/spacing/count. See {@link TextureGridOptions}.
   * @returns The frames, ordered row-major. At most `columns * rows`
   * entries, fewer when {@link TextureGridOptions.count} caps it.
   *
   * @example
   * ```ts
   * // A 4x4 tileset of 32px tiles -> 16 textures, tiles[row * 4 + col].
   * const tiles = Texture.grid(tileset, {
   *   frameWidth: 32,
   *   frameHeight: 32,
   *   columns: 4,
   *   rows: 4,
   * });
   * ```
   */
  public static grid(
    asset: ImageAsset,
    options: TextureGridOptions,
  ): Texture[] {
    const {
      frameWidth,
      frameHeight,
      columns,
      rows,
      offsetX = 0,
      offsetY = 0,
      spacingX = 0,
      spacingY = 0,
    } = options;

    const cellCount = columns * rows;
    const limit = Math.min(options.count ?? cellCount, cellCount);

    const textures: Texture[] = [];

    for (let index = 0; index < limit; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);

      textures.push(
        new Texture(asset, {
          x: offsetX + column * (frameWidth + spacingX),
          y: offsetY + row * (frameHeight + spacingY),
          width: frameWidth,
          height: frameHeight,
        }),
      );
    }

    return textures;
  }

  private readonly _texture: PixiTexture;

  /**
   * @param asset The image this texture views.
   * @param frame Optional sub-region to sample. When omitted, the texture
   * covers the whole image and reuses the asset's own GPU texture directly
   * (no allocation). When given, a sub-texture sharing the asset's source is
   * created for that {@link TextureFrame}.
   */
  constructor(
    public readonly asset: ImageAsset,
    public readonly frame: TextureFrame | null = null,
  ) {
    this._texture = frame
      ? new PixiTexture({
          source: asset.raw.source,
          frame: new PixiRectangle(frame.x, frame.y, frame.width, frame.height),
        })
      : asset.raw;
  }

  /**
   * Direct access to the underlying PIXI `Texture` instance.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — custom UV manipulation, trim/rotate frame
   * metadata, feeding the texture into a mesh or shader, anything we haven't
   * decided how to model yet. Code that touches `raw` is coupled to PIXI's
   * public API and may break when:
   *
   * - arcade2d upgrades PIXI (including minor versions).
   * - PIXI itself ships a breaking change.
   * - arcade2d swaps PIXI for a different renderer.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed accessors on this class; reach for `raw` only
   * when no equivalent exists, and isolate the access behind your own helper
   * so the coupling is in one place.
   */
  public get raw(): PixiTexture {
    return this._texture;
  }

  /**
   * The drawable width in pixels — the frame width for a sub-region texture,
   * or the full image width otherwise.
   */
  public get width(): number {
    return this._texture.width;
  }

  /**
   * The drawable height in pixels — the frame height for a sub-region
   * texture, or the full image height otherwise.
   */
  public get height(): number {
    return this._texture.height;
  }
}
