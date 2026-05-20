import { Point } from '../geometry';
import { World } from './world';

function createWorld(): World {
  return new World({ components: () => ({}) });
}

describe('WorldObject transforms', () => {
  test('localToWorld of (0, 0) is the host position', () => {
    const world = createWorld();
    const obj = world.createEmpty(new Point(50, 75));

    const result = obj.localToWorld({ x: 0, y: 0 });

    expect(result.x).toBe(50);
    expect(result.y).toBe(75);
  });

  test('localToWorld translates, rotates, and scales in order', () => {
    const world = createWorld();
    const obj = world.createEmpty(new Point(10, 20));
    obj.rotation = Math.PI / 2;
    obj.scale.set(2, 2);

    // Local (1, 0) → scale to (2, 0) → rotate 90° CW (in screen-y-down,
    // that's into +y) → (0, 2) → translate by host → (10, 22).
    const result = obj.localToWorld({ x: 1, y: 0 });

    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(22);
  });

  test('worldToLocal of host position is (0, 0)', () => {
    const world = createWorld();
    const obj = world.createEmpty(new Point(33, 44));

    const result = obj.worldToLocal({ x: 33, y: 44 });

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  test('worldToLocal inverts the forward transform', () => {
    const world = createWorld();
    const obj = world.createEmpty(new Point(10, -5));
    obj.rotation = 1.234;
    obj.scale.set(2.5, 0.5);

    const local = { x: 7, y: -3 };
    const world1 = obj.localToWorld(local);
    const roundTripped = obj.worldToLocal(world1);

    expect(roundTripped.x).toBeCloseTo(local.x);
    expect(roundTripped.y).toBeCloseTo(local.y);
  });

  test('returns a fresh Point — mutating result does not affect host state', () => {
    const world = createWorld();
    const obj = world.createEmpty(new Point(10, 20));

    const result = obj.localToWorld({ x: 5, y: 0 });
    result.set(999, 999);

    expect(obj.position.x).toBe(10);
    expect(obj.position.y).toBe(20);
  });

  test('worldToLocal preserves axis when host scale is zero on that axis', () => {
    // Zero-scale is degenerate — containment against a collapsed shape is
    // undefined either way — but we explicitly skip dividing by zero so the
    // returned coordinates stay finite rather than becoming Infinity/NaN.
    const world = createWorld();
    const obj = world.createEmpty(new Point(0, 0));
    obj.scale.set(0, 0);

    const result = obj.worldToLocal({ x: 5, y: 7 });

    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
  });
});
