import { Camera } from './camera';
import { World } from './world';

function createBareWorld(): World {
  return new World({ components: () => ({}) });
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

  test('defaults to position (0, 0) and rotation 0', () => {
    const camera = createBareWorld().camera;

    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBe(0);
    expect(camera.rotation).toBe(0);
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
        new World({
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

    const world = new World({
      components: (world) => ({
        consumer: () => new CameraConsumer(world),
      }),
    });

    expect(resolved).toBe(world.camera);
  });
});
