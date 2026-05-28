import { Application, Container, Text as PixiText } from 'pixi.js';
import { FontAsset } from '../assets';
import { Game } from '../game';
import { Point } from '../geometry';
import { World } from '../world';
import { Scene } from './scene';
import { Text } from './text';

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

function fakeFontAsset(family = 'Press Start 2P'): FontAsset {
  const face = { family } as unknown as FontFace;
  return new FontAsset('pixel', 'ui', 'press-start-2p.ttf', face, family);
}

describe('Text', () => {
  test('wraps a Pixi Text drawing the given string', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();

    const text = new Text(object, 'Hello');

    expect(text.raw).toBeInstanceOf(PixiText);
    expect(text.text).toBe('Hello');
  });

  describe('options', () => {
    test('defaults to sans-serif at 16px white centred', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x');

      expect(text.fontFamily).toBe('sans-serif');
      expect(text.fontSize).toBe(16);
      expect(text.fill).toBe(0xffffff);
      expect(text.anchor).toEqual(new Point(0.5, 0.5));
      expect(text.align).toBe('left');
      expect(text.alpha).toBe(1);
      expect(text.visible).toBe(true);
    });

    test('reads the family from a FontAsset', () => {
      const { world } = createWorldWithScene();
      const font = fakeFontAsset();

      const text = new Text(world.createEmpty(), 'x', { fontFamily: font });

      expect(text.fontFamily).toBe('Press Start 2P');
    });

    test('accepts a raw CSS family string', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x', {
        fontFamily: 'monospace',
      });

      expect(text.fontFamily).toBe('monospace');
    });

    test('accepts a scalar anchor for both axes', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x', { anchor: 0 });

      expect(text.anchor).toEqual(new Point(0, 0));
    });

    test('accepts a per-axis anchor point', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x', {
        anchor: { x: 0.25, y: 0.75 },
      });

      expect(text.anchor).toEqual(new Point(0.25, 0.75));
    });

    test('applies fontSize, fill, align, alpha, and visibility', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x', {
        fontSize: 24,
        fill: 0xff0000,
        align: 'center',
        alpha: 0.5,
        visible: false,
      });

      expect(text.fontSize).toBe(24);
      expect(text.fill).toBe(0xff0000);
      expect(text.align).toBe('center');
      expect(text.alpha).toBe(0.5);
      expect(text.visible).toBe(false);
    });
  });

  describe('setText', () => {
    test('updates the rendered string', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'before');

      text.setText('after');

      expect(text.text).toBe('after');
      expect(text.raw.text).toBe('after');
    });

    test('the text setter is equivalent to setText', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'a');

      text.text = 'b';

      expect(text.text).toBe('b');
    });
  });

  describe('setFontFamily', () => {
    test('accepts a FontAsset and uses its family', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x');

      text.setFontFamily(fakeFontAsset('Inter'));

      expect(text.fontFamily).toBe('Inter');
    });

    test('accepts a raw CSS family string', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x');

      text.setFontFamily('"Comic Sans MS", cursive');

      expect(text.fontFamily).toBe('"Comic Sans MS", cursive');
    });
  });

  describe('setAnchor', () => {
    test('sets both axes when given one value', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x');

      text.setAnchor(0.2);

      expect(text.anchor).toEqual(new Point(0.2, 0.2));
    });

    test('sets axes independently when given two values', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x');

      text.setAnchor(0.1, 0.9);

      expect(text.anchor).toEqual(new Point(0.1, 0.9));
    });
  });

  describe('mutable properties', () => {
    test('fontSize, fill, align, alpha, and visible round-trip through the accessors', () => {
      const { world } = createWorldWithScene();
      const text = new Text(world.createEmpty(), 'x');

      text.fontSize = 32;
      text.fill = '#abcdef';
      text.align = 'right';
      text.alpha = 0.25;
      text.visible = false;

      expect(text.fontSize).toBe(32);
      expect(text.fill).toBe('#abcdef');
      expect(text.align).toBe('right');
      expect(text.alpha).toBe(0.25);
      expect(text.visible).toBe(false);
    });
  });

  test('parents to the scene on add and detaches on destroy', () => {
    const { world, scene } = createWorldWithScene();
    const object = world.createEmpty();
    const text = new Text(object, 'hi');

    object.addComponent('text', text);
    expect(scene.raw.children).toContain(text.raw);

    object.destroy();
    world.update();
    expect(scene.raw.children).not.toContain(text.raw);
  });
});
