import { WorldUpdate } from './update';

describe('WorldUpdate', () => {
  describe('time-unit accessors', () => {
    test('deltaMilliseconds is what the constructor was given', () => {
      const update = new WorldUpdate(16, 100, 5);

      expect(update.deltaMilliseconds).toBe(16);
    });

    test('deltaSeconds is deltaMilliseconds divided by 1000', () => {
      const update = new WorldUpdate(250, 0, 0);

      expect(update.deltaSeconds).toBe(0.25);
    });

    test('elapsedMilliseconds is what the constructor was given', () => {
      const update = new WorldUpdate(16, 2500, 5);

      expect(update.elapsedMilliseconds).toBe(2500);
    });

    test('elapsedSeconds is elapsedMilliseconds divided by 1000', () => {
      const update = new WorldUpdate(16, 2500, 5);

      expect(update.elapsedSeconds).toBe(2.5);
    });

    test('frameIndex is what the constructor was given', () => {
      const update = new WorldUpdate(16, 100, 42);

      expect(update.frameIndex).toBe(42);
    });
  });

  describe('first-tick semantics', () => {
    test('a zero deltaMilliseconds produces zero deltaSeconds', () => {
      const update = new WorldUpdate(0, 0, 0);

      expect(update.deltaMilliseconds).toBe(0);
      expect(update.deltaSeconds).toBe(0);
    });

    test('frameIndex 0 is a legal first-tick value', () => {
      const update = new WorldUpdate(0, 0, 0);

      expect(update.frameIndex).toBe(0);
    });
  });
});
