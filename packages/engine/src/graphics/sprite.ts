import { Sprite as PixiSprite } from 'pixi.js';
import { Point } from '../geometry';
import { WorldObject } from '../world';
import { AbstractGraphics } from './abstract-graphics';
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
 * @see {@link AbstractGraphics} for the inherited lifecycle and transform sync.
 */
export class Sprite extends AbstractGraphics<PixiSprite> {
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
    const display = new PixiSprite(texture.raw);

    const anchor = options.anchor ?? 0.5;
    if (typeof anchor === 'number') {
      display.anchor.set(anchor, anchor);
    } else {
      display.anchor.set(anchor.x, anchor.y);
    }

    display.tint = options.tint ?? 0xffffff;
    display.alpha = options.alpha ?? 1;
    display.visible = options.visible ?? true;

    super(host, display);

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

  /**
   * The anchor point as a fresh {@link Point} of per-axis fractions (`0`–`1`).
   * See {@link SpriteOptions.anchor} for the meaning. Returned by value;
   * mutating the result does not affect the sprite — use
   * {@link Sprite.setAnchor}.
   */
  public get anchor(): Point {
    return new Point(this.raw.anchor.x, this.raw.anchor.y);
  }

  /**
   * Sets the anchor point — the spot on the texture that sits on the host's
   * position — as a fraction of the texture's size.
   *
   * @param x The horizontal anchor fraction (`0` left, `1` right).
   * @param y The vertical anchor fraction (`0` top, `1` bottom). Defaults to
   * `x`, so `setAnchor(0.5)` centres on both axes.
   */
  public setAnchor(x: number, y: number = x): void {
    this.raw.anchor.set(x, y);
  }

  /**
   * Multiplicative tint as a 24-bit RGB integer; `0xffffff` is untinted. See
   * {@link SpriteOptions.tint}.
   */
  public get tint(): number {
    return this.raw.tint as number;
  }

  public set tint(value: number) {
    this.raw.tint = value;
  }

  /**
   * Opacity from `0` (transparent) to `1` (opaque). See
   * {@link SpriteOptions.alpha}.
   */
  public get alpha(): number {
    return this.raw.alpha;
  }

  public set alpha(value: number) {
    this.raw.alpha = value;
  }

  /**
   * Whether the sprite is drawn. A hidden sprite still ticks and stays
   * transform-synced; it is just skipped by the renderer.
   */
  public get visible(): boolean {
    return this.raw.visible;
  }

  public set visible(value: boolean) {
    this.raw.visible = value;
  }
}
