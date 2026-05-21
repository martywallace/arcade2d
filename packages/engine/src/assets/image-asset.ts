import { Texture } from 'pixi.js';
import { Asset } from './asset';
import { AssetType } from './asset.constants';

/**
 * An {@link Asset} wrapping a loaded raster image as a GPU texture.
 *
 * `ImageAsset` is what {@link AssetLibrary.load} produces for any path that
 * resolves to {@link AssetType.Image} — PNG, JPEG, WebP, GIF, AVIF, BMP, or
 * SVG. It is the handoff between the asset layer and the rendering layer:
 * texture- and sprite-rendering components take an `ImageAsset` and pull the
 * underlying texture from it internally, so game code references images by
 * key and never touches a texture object itself.
 *
 * The PIXI `Texture` is deliberately *not* part of arcade2d's stable surface
 * — it is reachable only through {@link ImageAsset.raw}, the escape hatch.
 * The dimensions a layout-minded caller actually needs are surfaced as plain
 * numbers via {@link ImageAsset.width} and {@link ImageAsset.height}.
 *
 * @example
 * ```ts
 * await game.assets.load('sprites/player.png', { key: 'player' });
 * const player = game.assets.get('player') as ImageAsset;
 * console.log(player.width, player.height);
 * ```
 *
 * @see {@link AssetLibrary} for how images are loaded and retrieved.
 */
export class ImageAsset extends Asset {
  public readonly type = AssetType.Image;

  /**
   * @param key See {@link Asset}. The name this image is stored under.
   * @param namespace See {@link Asset}. The group this image belongs to.
   * @param src See {@link Asset}. The resolved path the image loaded from.
   * @param _texture The parsed GPU texture, held privately. Exposed only via
   * {@link ImageAsset.raw}; the public surface speaks in arcade2d terms.
   */
  constructor(
    key: string,
    namespace: string,
    src: string,
    private readonly _texture: Texture,
  ) {
    super(key, namespace, src);
  }

  /**
   * Direct access to the underlying PIXI `Texture` instance.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — feeding the texture into a custom shader or
   * filter, building a `TilingSprite`, slicing sub-textures by frame,
   * anything we haven't decided how to model yet. Code that touches `raw` is
   * coupled to PIXI's public API and may break when:
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
  public get raw(): Texture {
    return this._texture;
  }

  /**
   * The image's width in pixels, as reported by the underlying texture.
   */
  public get width(): number {
    return this._texture.width;
  }

  /**
   * The image's height in pixels, as reported by the underlying texture.
   */
  public get height(): number {
    return this._texture.height;
  }
}
