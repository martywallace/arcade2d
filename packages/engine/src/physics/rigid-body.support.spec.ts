import RAPIER from '@dimforge/rapier2d-compat';
import { Circle, Polygon, Rectangle } from '../geometry';
import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { initPhysics } from './physics.support';
import { toColliderDesc } from './rigid-body.support';
import type { Capsule } from './rigid-body.types';

// Rapier's ColliderDesc factories touch the WASM module, so it must be
// initialised before any conversion runs.
beforeAll(async () => {
  await initPhysics();
});

function expectInvalidShape(run: () => unknown): void {
  let error: EngineError | null = null;

  try {
    run();
  } catch (caught) {
    error = caught as EngineError;
  }

  expect(error).toBeInstanceOf(EngineError);
  expect(error?.code).toBe(ErrorCode.PHYSICS_INVALID_SHAPE);
}

describe('toColliderDesc', () => {
  describe('Circle', () => {
    test('maps to a ball with the same radius', () => {
      const desc = toColliderDesc(new Circle(20));

      expect(desc.shape.type).toBe(RAPIER.ShapeType.Ball);
      expect((desc.shape as RAPIER.Ball).radius).toBe(20);
    });

    test('throws PHYSICS_INVALID_SHAPE for a non-positive radius', () => {
      expectInvalidShape(() => toColliderDesc(new Circle(0)));
    });
  });

  describe('Rectangle', () => {
    test('maps to a cuboid centered on the origin with half extents', () => {
      const desc = toColliderDesc(new Rectangle(40, 60));

      expect(desc.shape.type).toBe(RAPIER.ShapeType.Cuboid);
      const halfExtents = (desc.shape as RAPIER.Cuboid).halfExtents;
      expect(halfExtents.x).toBeCloseTo(20);
      expect(halfExtents.y).toBeCloseTo(30);
    });

    test('throws PHYSICS_INVALID_SHAPE for a zero-area rectangle', () => {
      expectInvalidShape(() => toColliderDesc(new Rectangle(0, 10)));
      expectInvalidShape(() => toColliderDesc(new Rectangle(10, 0)));
    });
  });

  describe('Polygon', () => {
    test('maps to the convex hull of its vertices', () => {
      const desc = toColliderDesc(
        new Polygon([
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
        ]),
      );

      expect(desc.shape.type).toBe(RAPIER.ShapeType.ConvexPolygon);
    });

    test('throws PHYSICS_INVALID_SHAPE for fewer than three vertices', () => {
      expectInvalidShape(() =>
        toColliderDesc(
          new Polygon([
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]),
        ),
      );
    });

    test('throws PHYSICS_INVALID_SHAPE when Rapier cannot build a hull', () => {
      // Rapier's convexHull returns null for a degenerate vertex set; stub it
      // so the null-handling branch is exercised deterministically regardless
      // of how forgiving the underlying build is.
      const spy = jest
        .spyOn(RAPIER.ColliderDesc, 'convexHull')
        .mockReturnValue(null);

      try {
        expectInvalidShape(() =>
          toColliderDesc(
            new Polygon([
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 },
            ]),
          ),
        );
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('Capsule', () => {
    test('maps to a capsule with the same measurements', () => {
      const capsule: Capsule = { halfHeight: 15, radius: 8 };
      const desc = toColliderDesc(capsule);

      expect(desc.shape.type).toBe(RAPIER.ShapeType.Capsule);
      expect((desc.shape as RAPIER.Capsule).halfHeight).toBeCloseTo(15);
      expect((desc.shape as RAPIER.Capsule).radius).toBeCloseTo(8);
    });

    test('throws PHYSICS_INVALID_SHAPE for a non-positive measurement', () => {
      expectInvalidShape(() => toColliderDesc({ halfHeight: 0, radius: 5 }));
      expectInvalidShape(() => toColliderDesc({ halfHeight: 5, radius: 0 }));
    });
  });

  test('throws PHYSICS_INVALID_SHAPE for an unrecognised shape', () => {
    expectInvalidShape(() => toColliderDesc({} as never));
  });
});
