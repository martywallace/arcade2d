import {
  Application,
  Container,
  Sprite as PixiSprite,
  Texture as PixiTexture,
  TextureSource,
} from 'pixi.js';
import { ImageAsset } from '../assets';
import { Game } from '../game';
import { Point } from '../geometry';
import { World } from '../world';
import { Scene } from './scene';
import { Sprite } from './sprite';
import { Texture } from './texture';

function createFakeApp(): Application {
  return {
    stage: new Container(),
    screen: { width: 800, height: 600 },
    renderer: {
      events: { pointer: { global: { x: 0, y: 0 } } },
    },
  } as unknown as Application;
}

function createWorldWithScene() {
  const app = createFakeApp();
  const world = new World(Game.createHeadless(), {
    components: (world) => ({
      scene: () => new Scene(world, app),
    }),
  });

  return { world, scene: world.getComponentByType(Scene) };
}

function texture(width = 32, height = 32): Texture {
  const source = new TextureSource({ width, height });
  const asset = new ImageAsset(
    'a',
    'default',
    'a.png',
    new PixiTexture({ source }),
  );

  return new Texture(asset);
}

describe('Sprite', () => {
  test('wraps a Pixi Sprite drawing the given texture', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();
    const tex = texture();

    const sprite = new Sprite(object, tex);

    expect(sprite.raw).toBeInstanceOf(PixiSprite);
    expect(sprite.texture).toBe(tex);
    expect(sprite.raw.texture).toBe(tex.raw);
  });

  describe('options', () => {
    test('centres the anchor by default', () => {
      const { world } = createWorldWithScene();
      const sprite = new Sprite(world.createEmpty(), texture());

      expect(sprite.anchor).toEqual(new Point(0.5, 0.5));
    });

    test('accepts a scalar anchor for both axes', () => {
      const { world } = createWorldWithScene();
      const sprite = new Sprite(world.createEmpty(), texture(), { anchor: 0 });

      expect(sprite.anchor).toEqual(new Point(0, 0));
    });

    test('accepts a per-axis anchor point', () => {
      const { world } = createWorldWithScene();
      const sprite = new Sprite(world.createEmpty(), texture(), {
        anchor: { x: 0.25, y: 0.75 },
      });

      expect(sprite.anchor).toEqual(new Point(0.25, 0.75));
    });

    test('applies tint, alpha, and visibility', () => {
      const { world } = createWorldWithScene();
      const sprite = new Sprite(world.createEmpty(), texture(), {
        tint: 0xff0000,
        alpha: 0.5,
        visible: false,
      });

      expect(sprite.tint).toBe(0xff0000);
      expect(sprite.alpha).toBe(0.5);
      expect(sprite.visible).toBe(false);
    });
  });

  describe('setTexture', () => {
    test('swaps the drawn texture without destroying the old one', () => {
      const { world } = createWorldWithScene();
      const first = texture();
      const second = texture(16, 16);
      const sprite = new Sprite(world.createEmpty(), first);

      sprite.setTexture(second);

      expect(sprite.texture).toBe(second);
      expect(sprite.raw.texture).toBe(second.raw);
      expect(first.raw.destroyed).toBe(false);
    });
  });

  describe('setAnchor', () => {
    test('sets both axes when given one value', () => {
      const { world } = createWorldWithScene();
      const sprite = new Sprite(world.createEmpty(), texture());

      sprite.setAnchor(0.2);

      expect(sprite.anchor).toEqual(new Point(0.2, 0.2));
    });

    test('sets axes independently when given two values', () => {
      const { world } = createWorldWithScene();
      const sprite = new Sprite(world.createEmpty(), texture());

      sprite.setAnchor(0.1, 0.9);

      expect(sprite.anchor).toEqual(new Point(0.1, 0.9));
    });
  });

  describe('mutable properties', () => {
    test('tint, alpha, and visible round-trip through the accessors', () => {
      const { world } = createWorldWithScene();
      const sprite = new Sprite(world.createEmpty(), texture());

      sprite.tint = 0x00ff00;
      sprite.alpha = 0.25;
      sprite.visible = false;

      expect(sprite.tint).toBe(0x00ff00);
      expect(sprite.alpha).toBe(0.25);
      expect(sprite.visible).toBe(false);
    });
  });

  test('parents to the scene on add and detaches on destroy', () => {
    const { world, scene } = createWorldWithScene();
    const object = world.createEmpty();
    const sprite = new Sprite(object, texture());

    object.addComponent('sprite', sprite);
    expect(scene.raw.children).toContain(sprite.raw);

    object.destroy();
    world.update();
    expect(scene.raw.children).not.toContain(sprite.raw);
  });
});
