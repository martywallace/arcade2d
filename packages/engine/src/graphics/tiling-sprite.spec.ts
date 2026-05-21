import {
  Application,
  Container,
  TilingSprite as PixiTilingSprite,
  Texture as PixiTexture,
  TextureSource,
} from 'pixi.js';
import { ImageAsset } from '../assets';
import { Game } from '../game';
import { Point } from '../geometry';
import { World } from '../world';
import { Scene } from './scene';
import { Texture } from './texture';
import { TilingSprite } from './tiling-sprite';

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

function texture(width = 16, height = 16): Texture {
  const source = new TextureSource({ width, height });
  const asset = new ImageAsset(
    't',
    'default',
    't.png',
    new PixiTexture({ source }),
  );

  return new Texture(asset);
}

describe('TilingSprite', () => {
  test('wraps a Pixi TilingSprite filling the given region', () => {
    const { world } = createWorldWithScene();
    const tex = texture();

    const tiling = new TilingSprite(world.createEmpty(), tex, {
      width: 320,
      height: 240,
    });

    expect(tiling.raw).toBeInstanceOf(PixiTilingSprite);
    expect(tiling.texture).toBe(tex);
    expect(tiling.width).toBe(320);
    expect(tiling.height).toBe(240);
  });

  describe('options', () => {
    test('defaults anchor to centre and tile scale to 1', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 100,
        height: 100,
      });

      expect(tiling.anchor).toEqual(new Point(0.5, 0.5));
      expect(tiling.tileScale).toEqual(new Point(1, 1));
      expect(tiling.tileOffset).toEqual(new Point(0, 0));
    });

    test('accepts scalar tile scale and anchor', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 100,
        height: 100,
        tileScale: 3,
        anchor: 0,
      });

      expect(tiling.tileScale).toEqual(new Point(3, 3));
      expect(tiling.anchor).toEqual(new Point(0, 0));
    });

    test('accepts per-axis tile scale, anchor, and a tile offset', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 100,
        height: 100,
        tileScale: { x: 2, y: 4 },
        anchor: { x: 0.25, y: 0.75 },
        tileOffset: { x: 8, y: 12 },
      });

      expect(tiling.tileScale).toEqual(new Point(2, 4));
      expect(tiling.anchor).toEqual(new Point(0.25, 0.75));
      expect(tiling.tileOffset).toEqual(new Point(8, 12));
    });

    test('applies tint, alpha, and visibility', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 10,
        height: 10,
        tint: 0xff0000,
        alpha: 0.5,
        visible: false,
      });

      expect(tiling.tint).toBe(0xff0000);
      expect(tiling.alpha).toBe(0.5);
      expect(tiling.visible).toBe(false);
    });
  });

  describe('mutators', () => {
    test('region width and height resize without touching scale', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 100,
        height: 100,
      });

      tiling.width = 256;
      tiling.height = 128;

      expect(tiling.width).toBe(256);
      expect(tiling.height).toBe(128);
    });

    test('setTexture swaps the repeated texture', () => {
      const { world } = createWorldWithScene();
      const next = texture(8, 8);
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 10,
        height: 10,
      });

      tiling.setTexture(next);

      expect(tiling.texture).toBe(next);
      expect(tiling.raw.texture).toBe(next.raw);
    });

    test('setTileScale and setTileOffset round-trip through the accessors', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 10,
        height: 10,
      });

      tiling.setTileScale(2);
      tiling.setTileOffset(5, 7);
      expect(tiling.tileScale).toEqual(new Point(2, 2));
      expect(tiling.tileOffset).toEqual(new Point(5, 7));

      tiling.setTileScale(3, 4);
      tiling.setAnchor(0.1, 0.2);
      expect(tiling.tileScale).toEqual(new Point(3, 4));
      expect(tiling.anchor).toEqual(new Point(0.1, 0.2));
    });

    test('tint, alpha, and visible round-trip through the accessors', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 10,
        height: 10,
      });

      tiling.tint = 0x00ff00;
      tiling.alpha = 0.25;
      tiling.visible = false;

      expect(tiling.tint).toBe(0x00ff00);
      expect(tiling.alpha).toBe(0.25);
      expect(tiling.visible).toBe(false);
    });

    test('setAnchor sets both axes when given one value', () => {
      const { world } = createWorldWithScene();
      const tiling = new TilingSprite(world.createEmpty(), texture(), {
        width: 10,
        height: 10,
      });

      tiling.setAnchor(0.3);

      expect(tiling.anchor).toEqual(new Point(0.3, 0.3));
    });
  });

  test('parents to the scene on add and detaches on destroy', () => {
    const { world, scene } = createWorldWithScene();
    const object = world.createEmpty();
    const tiling = new TilingSprite(object, texture(), {
      width: 50,
      height: 50,
    });

    object.addComponent('floor', tiling);
    expect(scene.raw.children).toContain(tiling.raw);

    object.destroy();
    world.update();
    expect(scene.raw.children).not.toContain(tiling.raw);
  });
});
