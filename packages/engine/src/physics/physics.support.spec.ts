import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import {
  assertPhysicsReady,
  initPhysics,
  isPhysicsReady,
} from './physics.support';

// These tests rely on the module-level readiness latch starting `false`.
// Jest gives each test file its own module registry, so the ordering here
// (assert-before-init, then init) exercises both states within one file.
describe('physics.support', () => {
  describe('before initialisation', () => {
    test('isPhysicsReady reports false', () => {
      expect(isPhysicsReady()).toBe(false);
    });

    test('assertPhysicsReady throws PHYSICS_NOT_INITIALISED', () => {
      let error: EngineError | null = null;

      try {
        assertPhysicsReady();
      } catch (caught) {
        error = caught as EngineError;
      }

      expect(error).toBeInstanceOf(EngineError);
      expect(error?.code).toBe(ErrorCode.PHYSICS_NOT_INITIALISED);
    });
  });

  describe('after initialisation', () => {
    test('initPhysics resolves and flips the readiness latch', async () => {
      await initPhysics();

      expect(isPhysicsReady()).toBe(true);
    });

    test('assertPhysicsReady no longer throws', () => {
      expect(() => assertPhysicsReady()).not.toThrow();
    });

    test('initPhysics is idempotent', async () => {
      await expect(initPhysics()).resolves.toBeUndefined();
      await expect(initPhysics()).resolves.toBeUndefined();
      expect(isPhysicsReady()).toBe(true);
    });
  });
});
