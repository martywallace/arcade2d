import { IDGenerator } from './id-generator';

describe('IDGenerator', () => {
  describe('next()', () => {
    test('produces base36 ids starting at 1', () => {
      const ids = new IDGenerator();

      expect(ids.next()).toBe('1');
      expect(ids.next()).toBe('2');
    });

    test('prepends the prefix with an @ separator when one is supplied', () => {
      const ids = new IDGenerator({ prefix: 'Player' });

      expect(ids.next()).toBe('Player@1');
      expect(ids.next()).toBe('Player@2');
    });
  });

  describe('peek()', () => {
    test('returns the id the next call to next() will produce without advancing', () => {
      const ids = new IDGenerator({ prefix: 'P' });

      expect(ids.peek()).toBe('P@1');
      expect(ids.peek()).toBe('P@1');
      expect(ids.next()).toBe('P@1');
      expect(ids.peek()).toBe('P@2');
    });
  });

  describe('count', () => {
    test('is 0 on a fresh generator and increments per next()', () => {
      const ids = new IDGenerator();

      expect(ids.count).toBe(0);

      ids.next();
      ids.next();
      ids.next();

      expect(ids.count).toBe(3);
    });

    test('is not advanced by peek()', () => {
      const ids = new IDGenerator();

      ids.peek();
      ids.peek();

      expect(ids.count).toBe(0);
    });
  });

  describe('state round-trip', () => {
    test('a generator restored from state continues issuing ids from where the original left off', () => {
      const original = new IDGenerator({ prefix: 'P' });
      original.next();
      original.next();
      original.next();

      const resumed = new IDGenerator(original.getState());

      expect(resumed.count).toBe(3);
      expect(resumed.next()).toBe('P@4');
    });

    test('prefix is preserved through the round-trip', () => {
      const original = new IDGenerator({ prefix: 'Enemy' });
      original.next();

      const resumed = new IDGenerator(original.getState());

      expect(resumed.prefix).toBe('Enemy');
      expect(resumed.next()).toBe('Enemy@2');
    });

    test('a missing prefix stays missing', () => {
      const original = new IDGenerator();
      original.next();

      const resumed = new IDGenerator(original.getState());

      expect(resumed.prefix).toBeUndefined();
      expect(resumed.next()).toBe('2');
    });
  });

  describe('constructor input validation', () => {
    test('a non-integer lastId is coerced to 0', () => {
      const ids = new IDGenerator({ lastId: 3.7 });

      expect(ids.count).toBe(0);
      expect(ids.next()).toBe('1');
    });

    test('a negative lastId is coerced to 0', () => {
      const ids = new IDGenerator({ lastId: -5 });

      expect(ids.count).toBe(0);
      expect(ids.next()).toBe('1');
    });

    test('NaN lastId is coerced to 0', () => {
      const ids = new IDGenerator({ lastId: Number.NaN });

      expect(ids.count).toBe(0);
    });
  });
});
