import { Game } from '../game';
import { Camera } from './camera';
import { World } from './world';

function createBareWorld(): World {
  return new World(Game.createHeadless(),{ components: () => ({}) });
}

describe('Camera', () => {
  test('every World gets an auto-attached camera accessible via world.camera', () => {
    const world = createBareWorld();

    expect(world.camera).toBeInstanceOf(Camera);
  });

  test('returns the same camera instance on repeated accesses', () => {
    const world = createBareWorld();

    expect(world.camera).toBe(world.camera);
  });

  test('defaults to a neutral transform (position 0,0, rotation 0, zoom 1)', () => {
    const camera = createBareWorld().camera;

    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(0);
    expect(camera.rotation).toBe(0);
    expect(camera.zoom).toBe(1);
    expect(camera.isShaking).toBe(false);
    expect(camera.shakeOffset.x).toBe(0);
    expect(camera.shakeOffset.y).toBe(0);
  });

  test('position is mutable in place', () => {
    const camera = createBareWorld().camera;

    camera.position.set(100, 200);

    expect(camera.position.x).toBe(100);
    expect(camera.position.y).toBe(200);
  });

  test('rotation is mutable', () => {
    const camera = createBareWorld().camera;

    camera.rotation = Math.PI / 2;

    expect(camera.rotation).toBe(Math.PI / 2);
  });

  test('throws COMPONENT_ALREADY_EXISTS when a user component tries to claim the reserved key', () => {
    expect(
      () =>
        new World(Game.createHeadless(),{
          components: (world) => ({
            camera: () => new Camera(world),
          }),
        }),
    ).toThrow(/already exists/);
  });

  test('is resolvable from user world components via requireSibling', () => {
    let resolved: Camera | null = null;

    class CameraConsumer {
      public readonly host: World;

      constructor(host: World) {
        this.host = host;
      }

      resolveDependencies(resolver: {
        requireSibling: (type: typeof Camera) => Camera;
      }): { camera: Camera } {
        return { camera: resolver.requireSibling(Camera) };
      }

      onAdded({ camera }: { camera: Camera }): void {
        resolved = camera;
      }

      onUpdate(): void {}
      onDestroy(): void {}
    }

    const world = new World(Game.createHeadless(),{
      components: (world) => ({
        consumer: () => new CameraConsumer(world),
      }),
    });

    expect(resolved).toBe(world.camera);
  });

  describe('shake', () => {
    // Pin the random angle and magnitude scalar so the shake's per-tick
    // jitter is deterministic. The Camera uses one Math.random call for an
    // angle and one for a [0..1) magnitude scalar; pinning both to a known
    // value lets us reason about the exact offset.
    let randomSpy: jest.SpyInstance<number, []>;

    beforeEach(() => {
      // 0.5 → angle = π, magnitude scalar = 0.5. With intensity 10 and
      // immediate evaluation (elapsed=0 → remaining=1 → magnitude=10), the
      // offset becomes (cos(π) * 5, sin(π) * 5) = (-5, 0).
      randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      randomSpy.mockRestore();
    });

    test('isShaking flips true while a shake is in flight and back to false when it ends', () => {
      // Mock performance.now so we can control update deltas deterministically.
      let now = 0;
      const nowSpy = jest
        .spyOn(performance, 'now')
        .mockImplementation(() => now);

      try {
        const world = createBareWorld();

        // First update establishes the "previous" timestamp with delta 0.
        world.update();

        world.camera.shake(10, 100);
        expect(world.camera.isShaking).toBe(true);

        // Advance past duration in one tick — shake should auto-stop.
        now = 500;
        world.update();
        expect(world.camera.isShaking).toBe(false);
        expect(world.camera.shakeOffset.x).toBe(0);
        expect(world.camera.shakeOffset.y).toBe(0);
      } finally {
        nowSpy.mockRestore();
      }
    });

    test('non-positive intensity or duration is a no-op (treated as stopShake)', () => {
      const world = createBareWorld();

      world.camera.shake(0, 100);
      expect(world.camera.isShaking).toBe(false);

      world.camera.shake(10, 0);
      expect(world.camera.isShaking).toBe(false);

      world.camera.shake(-5, 100);
      expect(world.camera.isShaking).toBe(false);
    });

    test('stopShake immediately clears the offset and isShaking', () => {
      const world = createBareWorld();

      world.camera.shake(10, 500);
      world.update();

      world.camera.stopShake();

      expect(world.camera.isShaking).toBe(false);
      expect(world.camera.shakeOffset.x).toBe(0);
      expect(world.camera.shakeOffset.y).toBe(0);
    });

    test('calling shake again while one is in flight replaces it rather than stacking', () => {
      const world = createBareWorld();

      world.camera.shake(10, 1000);
      world.update();

      // Replace with a tiny shake — the new one starts fresh, no leftover
      // duration from the previous.
      world.camera.shake(2, 50);

      // Subsequent ticks should show offsets sized to the new (smaller)
      // intensity, not the original.
      world.update();
      expect(Math.abs(world.camera.shakeOffset.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(world.camera.shakeOffset.y)).toBeLessThanOrEqual(2);
    });

    test('shake offset stays within current decayed intensity', () => {
      const world = createBareWorld();

      world.camera.shake(10, 1000);
      world.update();

      // With Math.random pinned to 0.5: angle=π, magnitude=0.5*10=5,
      // resulting offset = (cos(π)*5, sin(π)*5) = (-5, ~0).
      expect(world.camera.shakeOffset.x).toBeCloseTo(-5);
      expect(world.camera.shakeOffset.y).toBeCloseTo(0);
    });
  });
});
