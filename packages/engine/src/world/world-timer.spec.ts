import { WorldTimer } from './world-timer';

describe('WorldTimer', () => {
  describe('constructor', () => {
    test('initialises value and initial to the supplied milliseconds', () => {
      const timer = new WorldTimer(500);

      expect(timer.value).toBe(500);
      expect(timer.initial).toBe(500);
    });

    test('accepts zero as the starting value and is immediately lapsed', () => {
      const timer = new WorldTimer(0);

      expect(timer.value).toBe(0);
      expect(timer.isLapsed).toBe(true);
    });

    test('accepts a negative starting value', () => {
      const timer = new WorldTimer(-50);

      expect(timer.value).toBe(-50);
      expect(timer.isLapsed).toBe(true);
    });
  });

  describe('increment()', () => {
    test('adds delta to the current value', () => {
      const timer = new WorldTimer(100);

      timer.increment(25);

      expect(timer.value).toBe(125);
    });

    test('accepts a negative delta (equivalent to decrement)', () => {
      const timer = new WorldTimer(100);

      timer.increment(-40);

      expect(timer.value).toBe(60);
    });

    test('returns this for chaining', () => {
      const timer = new WorldTimer(100);

      expect(timer.increment(10)).toBe(timer);
    });
  });

  describe('decrement()', () => {
    test('subtracts delta from the current value', () => {
      const timer = new WorldTimer(100);

      timer.decrement(30);

      expect(timer.value).toBe(70);
    });

    test('allows the value to go negative (overshoot is preserved)', () => {
      const timer = new WorldTimer(50);

      timer.decrement(80);

      expect(timer.value).toBe(-30);
    });

    test('accepts a negative delta (equivalent to increment)', () => {
      const timer = new WorldTimer(100);

      timer.decrement(-15);

      expect(timer.value).toBe(115);
    });

    test('returns this for chaining', () => {
      const timer = new WorldTimer(100);

      expect(timer.decrement(10)).toBe(timer);
    });
  });

  describe('isLapsed', () => {
    test('is false while value is strictly positive', () => {
      const timer = new WorldTimer(100);

      expect(timer.isLapsed).toBe(false);

      timer.decrement(99);

      expect(timer.isLapsed).toBe(false);
    });

    test('is true exactly when value reaches zero', () => {
      const timer = new WorldTimer(100);

      timer.decrement(100);

      expect(timer.value).toBe(0);
      expect(timer.isLapsed).toBe(true);
    });

    test('is true while value is negative', () => {
      const timer = new WorldTimer(100);

      timer.decrement(150);

      expect(timer.isLapsed).toBe(true);
    });

    test('returns to false after the value is restored above zero', () => {
      const timer = new WorldTimer(100);

      timer.decrement(150);
      expect(timer.isLapsed).toBe(true);

      timer.increment(200);
      expect(timer.isLapsed).toBe(false);
    });
  });

  describe('set()', () => {
    test('overwrites the current value', () => {
      const timer = new WorldTimer(100);

      timer.decrement(40);
      timer.set(10);

      expect(timer.value).toBe(10);
    });

    test('does not change the initial value used by reset()', () => {
      const timer = new WorldTimer(100);

      timer.set(7);
      timer.reset();

      expect(timer.value).toBe(100);
    });

    test('returns this for chaining', () => {
      const timer = new WorldTimer(100);

      expect(timer.set(50)).toBe(timer);
    });
  });

  describe('reset()', () => {
    test('restores the value to the originally constructed initial', () => {
      const timer = new WorldTimer(250);

      timer.decrement(300);
      timer.reset();

      expect(timer.value).toBe(250);
      expect(timer.isLapsed).toBe(false);
    });

    test('returns this for chaining', () => {
      const timer = new WorldTimer(100);

      expect(timer.reset()).toBe(timer);
    });
  });

  describe('usage patterns', () => {
    test('decrement-then-isLapsed chains in a single expression (lifetime pattern)', () => {
      const timer = new WorldTimer(100);

      // First tick: 60ms elapsed, still alive.
      expect(timer.decrement(60).isLapsed).toBe(false);

      // Second tick: another 60ms, total 120ms — lapsed.
      expect(timer.decrement(60).isLapsed).toBe(true);
    });

    test('reset after lapse cycles repeatedly (recurring-interval pattern)', () => {
      const timer = new WorldTimer(250);
      const fires: number[] = [];

      // Simulate eight frames at 100ms apiece — 800ms total, three fires
      // expected.
      for (let frame = 0; frame < 8; frame++) {
        if (timer.decrement(100).isLapsed) {
          fires.push(frame);
          timer.reset();
        }
      }

      expect(fires).toEqual([2, 5]);
    });
  });
});
