import {
  Application,
  Container,
  Sprite as PixiSprite,
  Texture as PixiTexture,
  TextureSource,
} from 'pixi.js';
import { ImageAsset } from '../assets';
import { ErrorCode } from '../error.constants';
import { Game } from '../game';
import { Point } from '../geometry';
import { World } from '../world';
import { WorldUpdate } from '../world/world-update';
import { AnimatedSprite } from './animated-sprite';
import { Scene } from './scene';
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

function frames(count: number, size = 16): Texture[] {
  return Array.from({ length: count }, () => {
    const source = new TextureSource({ width: size, height: size });
    const asset = new ImageAsset('a', 'default', 'a.png', new PixiTexture({ source }));
    return new Texture(asset);
  });
}

// Advances the sprite by `ms` of simulated time through its onUpdate hook.
function tick(sprite: AnimatedSprite, ms: number): void {
  sprite.onUpdate(new WorldUpdate(ms, ms, 0));
}

describe('AnimatedSprite', () => {
  test('throws ANIMATED_SPRITE_EMPTY_FRAMES when constructed with no frames', () => {
    const { world } = createWorldWithScene();
    const object = world.createEmpty();

    expect(() => new AnimatedSprite(object, [])).toThrow(
      expect.objectContaining({ code: ErrorCode.ANIMATED_SPRITE_EMPTY_FRAMES }),
    );
  });

  test('wraps a Pixi Sprite drawing the first frame initially', () => {
    const { world } = createWorldWithScene();
    const fs = frames(4);
    const sprite = new AnimatedSprite(world.createEmpty(), fs);

    expect(sprite.raw).toBeInstanceOf(PixiSprite);
    expect(sprite.currentFrame).toBe(0);
    expect(sprite.frameCount).toBe(4);
    expect(sprite.texture).toBe(fs[0]);
    expect(sprite.raw.texture).toBe(fs[0]!.raw);
  });

  describe('playback', () => {
    test('advances one frame once a frame duration elapses', () => {
      const { world } = createWorldWithScene();
      const fs = frames(4);
      const sprite = new AnimatedSprite(world.createEmpty(), fs, { fps: 10 });

      tick(sprite, 100);

      expect(sprite.currentFrame).toBe(1);
      expect(sprite.raw.texture).toBe(fs[1]!.raw);
    });

    test('does not advance before a frame duration elapses', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(4), {
        fps: 10,
      });

      tick(sprite, 99);

      expect(sprite.currentFrame).toBe(0);
    });

    test('banks elapsed time so a long tick advances multiple frames', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(4), {
        fps: 10,
      });

      tick(sprite, 250);

      expect(sprite.currentFrame).toBe(2);

      // 50ms was banked; another 50ms reaches the next boundary.
      tick(sprite, 50);
      expect(sprite.currentFrame).toBe(3);
    });

    test('loops from the last frame back to the first by default', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(3), {
        fps: 10,
      });

      tick(sprite, 300); // 3 boundaries: 0->1->2->0

      expect(sprite.currentFrame).toBe(0);
      expect(sprite.isPlaying).toBe(true);
    });
  });

  describe('non-looping completion', () => {
    test('holds on the final frame, stops, and fires onComplete once', () => {
      const { world } = createWorldWithScene();
      const onComplete = jest.fn();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(3), {
        fps: 10,
        loop: false,
        onComplete,
      });

      // 0->1->2 reaches the last frame; still playing, not yet complete.
      tick(sprite, 200);
      expect(sprite.currentFrame).toBe(2);
      expect(sprite.isPlaying).toBe(true);
      expect(onComplete).not.toHaveBeenCalled();

      // The next boundary completes: holds frame 2, stops, fires once.
      tick(sprite, 100);
      expect(sprite.currentFrame).toBe(2);
      expect(sprite.isPlaying).toBe(false);
      expect(onComplete).toHaveBeenCalledTimes(1);

      // Further ticks do nothing and never re-fire.
      tick(sprite, 1000);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('autoplay', () => {
    test('autoplay:false shows the first frame and does not advance', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(4), {
        fps: 10,
        autoplay: false,
      });

      expect(sprite.isPlaying).toBe(false);
      tick(sprite, 1000);
      expect(sprite.currentFrame).toBe(0);
    });
  });

  describe('play / pause / stop', () => {
    test('pause halts on the current frame; play resumes from it', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(4), {
        fps: 10,
      });

      tick(sprite, 100); // frame 1
      sprite.pause();
      expect(sprite.isPlaying).toBe(false);

      tick(sprite, 1000);
      expect(sprite.currentFrame).toBe(1);

      sprite.play();
      tick(sprite, 100);
      expect(sprite.currentFrame).toBe(2);
    });

    test('stop halts and resets to the first frame', () => {
      const { world } = createWorldWithScene();
      const fs = frames(4);
      const sprite = new AnimatedSprite(world.createEmpty(), fs, { fps: 10 });

      tick(sprite, 200);
      expect(sprite.currentFrame).toBe(2);

      sprite.stop();
      expect(sprite.isPlaying).toBe(false);
      expect(sprite.currentFrame).toBe(0);
      expect(sprite.raw.texture).toBe(fs[0]!.raw);
    });

    test('play / pause / stop are chainable', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(4));

      expect(sprite.play()).toBe(sprite);
      expect(sprite.pause()).toBe(sprite);
      expect(sprite.stop()).toBe(sprite);
    });
  });

  describe('gotoFrame', () => {
    test('jumps to a frame and updates the drawn texture', () => {
      const { world } = createWorldWithScene();
      const fs = frames(4);
      const sprite = new AnimatedSprite(world.createEmpty(), fs);

      sprite.gotoFrame(2);

      expect(sprite.currentFrame).toBe(2);
      expect(sprite.raw.texture).toBe(fs[2]!.raw);
    });

    test('clamps out-of-range indices', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(4));

      sprite.gotoFrame(99);
      expect(sprite.currentFrame).toBe(3);

      sprite.gotoFrame(-5);
      expect(sprite.currentFrame).toBe(0);
    });
  });

  describe('single-frame animations', () => {
    test('never advance and ignore ticks', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(1), {
        fps: 60,
      });

      tick(sprite, 10000);
      expect(sprite.currentFrame).toBe(0);
    });
  });

  describe('rate and looping setters', () => {
    test('fps round-trips and changes the advance cadence', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(4), {
        fps: 10,
      });

      sprite.fps = 20;
      expect(sprite.fps).toBeCloseTo(20);

      tick(sprite, 50); // 20fps -> 50ms per frame
      expect(sprite.currentFrame).toBe(1);
    });

    test('loop round-trips and can be flipped at runtime', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(2), {
        fps: 10,
        loop: false,
      });

      expect(sprite.loop).toBe(false);
      sprite.loop = true;
      expect(sprite.loop).toBe(true);

      tick(sprite, 300); // would have stopped if non-looping
      expect(sprite.isPlaying).toBe(true);
    });
  });

  describe('options', () => {
    test('centres the anchor by default', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(2));

      expect(sprite.anchor).toEqual(new Point(0.5, 0.5));
    });

    test('accepts a per-axis anchor point', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(2), {
        anchor: { x: 0.25, y: 0.75 },
      });

      expect(sprite.anchor).toEqual(new Point(0.25, 0.75));
    });

    test('accepts a scalar anchor for both axes', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(2), {
        anchor: 0,
      });

      expect(sprite.anchor).toEqual(new Point(0, 0));
    });

    test('applies tint, alpha, and visibility', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(2), {
        tint: 0xff0000,
        alpha: 0.5,
        visible: false,
      });

      expect(sprite.tint).toBe(0xff0000);
      expect(sprite.alpha).toBe(0.5);
      expect(sprite.visible).toBe(false);
    });
  });

  describe('mutable properties', () => {
    test('setAnchor, tint, alpha, visible round-trip through accessors', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(2));

      sprite.setAnchor(0.1, 0.9);
      sprite.tint = 0x00ff00;
      sprite.alpha = 0.25;
      sprite.visible = false;

      expect(sprite.anchor).toEqual(new Point(0.1, 0.9));
      expect(sprite.tint).toBe(0x00ff00);
      expect(sprite.alpha).toBe(0.25);
      expect(sprite.visible).toBe(false);
    });

    test('setAnchor applies one value to both axes', () => {
      const { world } = createWorldWithScene();
      const sprite = new AnimatedSprite(world.createEmpty(), frames(2));

      sprite.setAnchor(0.2);
      expect(sprite.anchor).toEqual(new Point(0.2, 0.2));
    });
  });

  test('parents to the scene on add and detaches on destroy', () => {
    const { world, scene } = createWorldWithScene();
    const object = world.createEmpty();
    const sprite = new AnimatedSprite(object, frames(2));

    object.addComponent('sprite', sprite);
    expect(scene.raw.children).toContain(sprite.raw);

    object.destroy();
    world.update();
    expect(scene.raw.children).not.toContain(sprite.raw);
  });
});
