import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Game } from '../game';
import { Point } from '../geometry';
import { World } from './world';

function createWorld(): World {
  return new World(Game.createHeadless(), { components: () => ({}) });
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

  test('localToWorld threads ancestry — a child offset rotates with its parent', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(100, 0));
    parent.rotation = Math.PI / 2;
    const child = world.createEmpty(new Point(10, 0), undefined);
    child.setParent(parent, { keepWorldTransform: false });

    // Child local origin sits at parent-local (10, 0); under the parent's 90°
    // rotation that offset becomes (0, 10), plus the parent's (100, 0).
    const result = child.localToWorld({ x: 0, y: 0 });

    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(10);
  });

  test('worldToLocal inverts localToWorld through ancestry', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(40, -10));
    parent.rotation = 0.6;
    parent.scale.set(2, 2);
    const child = world.createEmpty(new Point(5, 3));
    child.rotation = -0.2;
    child.setParent(parent, { keepWorldTransform: false });

    const local = { x: 7, y: -4 };
    const roundTripped = child.worldToLocal(child.localToWorld(local));

    expect(roundTripped.x).toBeCloseTo(local.x);
    expect(roundTripped.y).toBeCloseTo(local.y);
  });
});

describe('WorldObject hierarchy', () => {
  test('a new object is a root with no parent and no children', () => {
    const world = createWorld();
    const obj = world.createEmpty();

    expect(obj.parent).toBeNull();
    expect(obj.children).toEqual([]);
  });

  test('setParent links parent and child on both sides', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    const child = world.createEmpty();

    child.setParent(parent);

    expect(child.parent).toBe(parent);
    expect(parent.children).toContain(child);
  });

  test('addChild is the mirror of setParent', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    const child = world.createEmpty();

    parent.addChild(child);

    expect(child.parent).toBe(parent);
    expect(parent.children).toContain(child);
  });

  test('reparenting detaches from the previous parent', () => {
    const world = createWorld();
    const first = world.createEmpty();
    const second = world.createEmpty();
    const child = world.createEmpty();

    child.setParent(first);
    child.setParent(second);

    expect(first.children).not.toContain(child);
    expect(second.children).toContain(child);
    expect(child.parent).toBe(second);
  });

  test('setParent(null) detaches to the world root', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    const child = world.createEmpty();
    child.setParent(parent);

    child.setParent(null);

    expect(child.parent).toBeNull();
    expect(parent.children).not.toContain(child);
  });

  test('removeChild only detaches a genuine child', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    const child = world.createEmpty();
    const stranger = world.createEmpty();
    child.setParent(parent);

    parent.removeChild(stranger);
    expect(child.parent).toBe(parent);

    parent.removeChild(child);
    expect(child.parent).toBeNull();
  });

  test('throws WORLD_OBJECT_HIERARCHY_CYCLE when parenting to itself', () => {
    const world = createWorld();
    const obj = world.createEmpty();

    let caught: unknown = null;
    try {
      obj.setParent(obj);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EngineError);
    expect((caught as EngineError).code).toBe(
      ErrorCode.WORLD_OBJECT_HIERARCHY_CYCLE,
    );
  });

  test('throws WORLD_OBJECT_HIERARCHY_CYCLE when parenting to a descendant', () => {
    const world = createWorld();
    const a = world.createEmpty();
    const b = world.createEmpty();
    const c = world.createEmpty();
    b.setParent(a);
    c.setParent(b);

    // a → b → c already; making a a child of c would close the loop.
    expect(() => a.setParent(c)).toThrow(EngineError);
    expect(a.parent).toBeNull();
  });

  test('throws WORLD_OBJECT_PARENT_FOREIGN across worlds', () => {
    const world = createWorld();
    const other = createWorld();
    const child = world.createEmpty();
    const foreignParent = other.createEmpty();

    let caught: unknown = null;
    try {
      child.setParent(foreignParent);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EngineError);
    expect((caught as EngineError).code).toBe(
      ErrorCode.WORLD_OBJECT_PARENT_FOREIGN,
    );
  });

  test('re-setting the same parent is a no-op that does not duplicate the child', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    const child = world.createEmpty();
    child.setParent(parent);

    child.setParent(parent);

    expect(parent.children.filter((c) => c === child)).toHaveLength(1);
  });
});

describe('WorldObject world transform', () => {
  test('a root object world transform equals its local transform', () => {
    const world = createWorld();
    const obj = world.createEmpty(new Point(15, 25));
    obj.rotation = 0.5;
    obj.scale.set(2, 3);

    expect(obj.worldPosition.x).toBeCloseTo(15);
    expect(obj.worldPosition.y).toBeCloseTo(25);
    expect(obj.worldRotation).toBeCloseTo(0.5);
    expect(obj.worldScale.x).toBeCloseTo(2);
    expect(obj.worldScale.y).toBeCloseTo(3);
  });

  test('child world position composes the parent transform', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(100, 50));
    const child = world.createEmpty(new Point(10, 0));
    child.setParent(parent, { keepWorldTransform: false });

    expect(child.worldPosition.x).toBeCloseTo(110);
    expect(child.worldPosition.y).toBeCloseTo(50);
  });

  test('parent rotation rotates the child around the parent origin', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(0, 0));
    parent.rotation = Math.PI / 2;
    const child = world.createEmpty(new Point(10, 0));
    child.setParent(parent, { keepWorldTransform: false });

    // (10, 0) rotated 90° clockwise in screen-y-down space → (0, 10).
    expect(child.worldPosition.x).toBeCloseTo(0);
    expect(child.worldPosition.y).toBeCloseTo(10);
  });

  test('world rotation and scale accumulate through ancestry', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    parent.rotation = 0.3;
    parent.scale.set(2, 2);
    const child = world.createEmpty();
    child.rotation = 0.2;
    child.scale.set(3, 3);
    child.setParent(parent, { keepWorldTransform: false });

    expect(child.worldRotation).toBeCloseTo(0.5);
    expect(child.worldScale.x).toBeCloseTo(6);
    expect(child.worldScale.y).toBeCloseTo(6);
  });

  test('world transform tracks live edits to an ancestor with no resolve step', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(0, 0));
    const child = world.createEmpty(new Point(5, 0));
    child.setParent(parent, { keepWorldTransform: false });

    parent.position.set(100, 100);

    expect(child.worldPosition.x).toBeCloseTo(105);
    expect(child.worldPosition.y).toBeCloseTo(100);
  });

  test('nesting composes to any depth', () => {
    const world = createWorld();
    const a = world.createEmpty(new Point(10, 0));
    const b = world.createEmpty(new Point(10, 0));
    const c = world.createEmpty(new Point(10, 0));
    b.setParent(a, { keepWorldTransform: false });
    c.setParent(b, { keepWorldTransform: false });

    expect(c.worldPosition.x).toBeCloseTo(30);
    expect(c.worldPosition.y).toBeCloseTo(0);
  });
});

describe('WorldObject setParent keepWorldTransform', () => {
  test('preserves the world position by default', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(100, 100));
    parent.rotation = Math.PI / 2;
    const child = world.createEmpty(new Point(40, 60));

    const before = child.worldPosition;
    child.setParent(parent);

    expect(child.worldPosition.x).toBeCloseTo(before.x);
    expect(child.worldPosition.y).toBeCloseTo(before.y);
  });

  test('preserves world position when detaching to root', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(50, 0));
    parent.rotation = 1;
    parent.scale.set(2, 2);
    const child = world.createEmpty(new Point(7, 9));
    child.setParent(parent, { keepWorldTransform: false });

    const before = child.worldPosition;
    child.setParent(null);

    expect(child.parent).toBeNull();
    expect(child.worldPosition.x).toBeCloseTo(before.x);
    expect(child.worldPosition.y).toBeCloseTo(before.y);
  });

  test('keepWorldTransform false leaves the local transform untouched', () => {
    const world = createWorld();
    const parent = world.createEmpty(new Point(100, 0));
    const child = world.createEmpty(new Point(40, 60));

    child.setParent(parent, { keepWorldTransform: false });

    expect(child.position.x).toBeCloseTo(40);
    expect(child.position.y).toBeCloseTo(60);
    expect(child.worldPosition.x).toBeCloseTo(140);
  });
});

describe('WorldObject destroy cascade', () => {
  function tick(world: World): void {
    world.update();
  }

  test('destroying a parent marks the whole subtree destroyed', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    const child = world.createEmpty();
    const grandchild = world.createEmpty();
    child.setParent(parent);
    grandchild.setParent(child);

    parent.destroy();

    expect(parent.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
    expect(grandchild.destroyed).toBe(true);
  });

  test('a swept child detaches itself from a surviving parent', () => {
    const world = createWorld();
    const parent = world.createEmpty();
    const child = world.createEmpty();
    child.setParent(parent);

    child.destroy();
    tick(world);

    expect(parent.children).not.toContain(child);
    expect(parent.destroyed).toBe(false);
  });

  test('cascade-destroyed objects are removed from the world after a tick', () => {
    const world = createWorld();
    const parent = world.createEmpty(undefined, ['tree']);
    const child = world.createEmpty(undefined, ['tree']);
    child.setParent(parent);

    parent.destroy();
    tick(world);

    expect(world.findByTag('tree')).toHaveLength(0);
  });
});
