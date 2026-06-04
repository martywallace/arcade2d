import { Sprite as PixiSprite } from 'pixi.js';
import { WorldObject } from '../world';
import { AbstractTexturedGraphics } from './abstract-textured-graphics';
import type { SpriteOptions } from './sprite.types';
import { Texture } from './texture';

/**
 * Renders a {@link Texture} attached to a {@link WorldObject} — the standard
 * way to put an image (or one frame of a spritesheet) on screen.
 *
 * `Sprite` wraps a renderer `Sprite` internally and builds on
 * {@link AbstractGraphics}, so it inherits the scene-parenting and
 * once-per-frame transform sync every graphics component gets: the sprite
 * tracks the host's position, rotation, and scale automatically. What it adds
 * is the textured-quad surface — the {@link Texture} to draw, plus anchor,
 * tint, opacity, and visibility.
 *
 * ## Sizing
 *
 * A sprite's intrinsic size is its texture's pixel size. It is **not** sized
 * with a width/height setter — doing so would fight the per-frame transform
 * sync, which copies the host's {@link WorldObject.scale} onto the display
 * every tick. To draw the image larger or smaller in world units, scale the
 * host: `host.scale.set(2, 2)`. This is the same model the shape graphics use
 * (local-space geometry scaled by the host).
 *
 * ## Frames and animation
 *
 * Frame selection lives on the {@link Texture}, not here — give the sprite a
 * sub-region `Texture` to draw one cell of a sheet. Swapping frames at
 * runtime (the basis of animation) is just {@link Sprite.setTexture} with the
 * next frame's `Texture`.
 *
 * @example
 * ```ts
 * const player = world.createObject();
 * const texture = new Texture(game.assets.get('player') as ImageAsset);
 *
 * player.addComponentFromFactory(
 *   'sprite',
 *   (host) => new Sprite(host, texture, { anchor: 0.5, tint: 0xffeecc }),
 * );
 * ```
 *
 * @see {@link Texture} for the drawable the sprite renders.
 * @see {@link AbstractTexturedGraphics} for the inherited anchor/tint and the
 * lifecycle/transform sync.
 */
export class Sprite extends AbstractTexturedGraphics<PixiSprite> {
  private _texture: Texture;

  /**
   * @param host The {@link WorldObject} this sprite is attached to. Its
   * transform drives the sprite's position, rotation, and scale each frame.
   * @param texture The {@link Texture} to draw. Held by reference, not
   * cloned — the same texture can back many sprites.
   * @param options Optional {@link SpriteOptions} (anchor, tint, alpha,
   * visibility).
   */
  constructor(
    host: WorldObject,
    texture: Texture,
    options: SpriteOptions = {},
  ) {
    super(host, new PixiSprite(texture.raw), options);

    this._texture = texture;
  }

  /**
   * The {@link Texture} this sprite is currently drawing.
   */
  public get texture(): Texture {
    return this._texture;
  }

  /**
   * Swaps the drawn {@link Texture}. The previous texture is left intact —
   * texture lifetime belongs to the owning {@link ImageAsset}, not the
   * sprite — so swapping between frames of a spritesheet is cheap and safe.
   * This is the seam an animated sprite drives.
   *
   * @param texture The texture to draw from now on.
   */
  public setTexture(texture: Texture): void {
    this._texture = texture;
    this.raw.texture = texture.raw;
  }
}
