import { EngineError, ErrorCode } from '../error';
import { Random } from './random';

describe('Random', () => {
  describe('seeding', () => {
    test('two generators with the same numeric seed produce the same stream', () => {
      const a = new Random({ seed: 42 });
      const b = new Random({ seed: 42 });

      for (let i = 0; i < 100; i++) {
        expect(a.next()).toBe(b.next());
      }
    });

    test('two generators with the same string seed produce the same stream', () => {
      const a = new Random({ seed: 'level-3' });
      const b = new Random({ seed: 'level-3' });

      for (let i = 0; i < 50; i++) {
        expect(a.next()).toBe(b.next());
      }
    });

    test('different string seeds produce different streams', () => {
      const a = new Random({ seed: 'alpha' });
      const b = new Random({ seed: 'beta' });

      expect(a.next()).not.toBe(b.next());
    });

    test('non-finite numeric seed falls through to the time-based path', () => {
      const a = new Random({ seed: Number.NaN });
      const b = new Random({ seed: Number.POSITIVE_INFINITY });

      // Both fell through to the time-based seed, so seeds are 32-bit ints.
      expect(Number.isInteger(a.seed)).toBe(true);
      expect(Number.isInteger(b.seed)).toBe(true);
    });

    test('exposes the seed it was constructed with', () => {
      const rng = new Random({ seed: 7 });

      expect(rng.seed).toBe(7);
    });

    test('coerces a fractional numeric seed to a 32-bit integer', () => {
      const a = new Random({ seed: 5.9 });
      const b = new Random({ seed: 5 });

      expect(a.seed).toBe(b.seed);
      expect(a.next()).toBe(b.next());
    });

    test('an unseeded generator still has a finite, integer seed', () => {
      const rng = new Random();

      expect(Number.isInteger(rng.seed)).toBe(true);
      expect(rng.seed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('next()', () => {
    test('returns values in [0, 1)', () => {
      const rng = new Random({ seed: 1 });

      for (let i = 0; i < 1000; i++) {
        const v = rng.next();

        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('between()', () => {
    test('returns values in [min, max)', () => {
      const rng = new Random({ seed: 2 });

      for (let i = 0; i < 1000; i++) {
        const v = rng.between(-10, 10);

        expect(v).toBeGreaterThanOrEqual(-10);
        expect(v).toBeLessThan(10);
      }
    });

    test('swaps min and max when min is greater', () => {
      const rng = new Random({ seed: 3 });

      for (let i = 0; i < 100; i++) {
        const v = rng.between(10, -10);

        expect(v).toBeGreaterThanOrEqual(-10);
        expect(v).toBeLessThan(10);
      }
    });

    test('returns exactly min when min equals max', () => {
      const rng = new Random({ seed: 4 });

      expect(rng.between(5, 5)).toBe(5);
    });
  });

  describe('integer()', () => {
    test('returns inclusive integers in [min, max]', () => {
      const rng = new Random({ seed: 5 });
      const seen = new Set<number>();

      for (let i = 0; i < 500; i++) {
        const v = rng.integer(1, 6);

        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);

        seen.add(v);
      }

      // 500 d6 rolls should cover every face with overwhelming probability.
      expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    });

    test('floors non-integer bounds', () => {
      const rng = new Random({ seed: 6 });

      for (let i = 0; i < 100; i++) {
        const v = rng.integer(1.7, 3.9);

        expect([1, 2, 3]).toContain(v);
      }
    });

    test('swaps min and max when min is greater', () => {
      const rng = new Random({ seed: 7 });

      for (let i = 0; i < 100; i++) {
        const v = rng.integer(6, 1);

        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    });

    test('returns the bound when min equals max', () => {
      const rng = new Random({ seed: 8 });

      expect(rng.integer(3, 3)).toBe(3);
    });
  });

  describe('boolean()', () => {
    test('returns roughly half true with the default probability', () => {
      const rng = new Random({ seed: 9 });
      let trues = 0;

      for (let i = 0; i < 10000; i++) {
        if (rng.boolean()) trues++;
      }

      expect(trues).toBeGreaterThan(4500);
      expect(trues).toBeLessThan(5500);
    });

    test('always returns false when probability is <= 0', () => {
      const rng = new Random({ seed: 10 });

      for (let i = 0; i < 100; i++) {
        expect(rng.boolean(0)).toBe(false);
        expect(rng.boolean(-1)).toBe(false);
      }
    });

    test('always returns true when probability is >= 1', () => {
      const rng = new Random({ seed: 11 });

      for (let i = 0; i < 100; i++) {
        expect(rng.boolean(1)).toBe(true);
        expect(rng.boolean(2)).toBe(true);
      }
    });

    test('still advances the stream regardless of probability', () => {
      const a = new Random({ seed: 12 });
      const b = new Random({ seed: 12 });

      a.boolean(0);
      b.boolean(1);

      // Both consumed one draw, so the next() values should now match.
      expect(a.next()).toBe(b.next());
    });
  });

  describe('sign()', () => {
    test('only ever returns -1 or 1', () => {
      const rng = new Random({ seed: 13 });
      const seen = new Set<number>();

      for (let i = 0; i < 200; i++) {
        seen.add(rng.sign());
      }

      expect(seen).toEqual(new Set([-1, 1]));
    });
  });

  describe('angle()', () => {
    test('returns values in [0, 2π)', () => {
      const rng = new Random({ seed: 14 });

      for (let i = 0; i < 1000; i++) {
        const v = rng.angle();

        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(Math.PI * 2);
      }
    });
  });

  describe('pick()', () => {
    test('returns an element from the collection', () => {
      const rng = new Random({ seed: 15 });
      const items = ['rock', 'paper', 'scissors'] as const;

      for (let i = 0; i < 100; i++) {
        expect(items).toContain(rng.pick(items));
      }
    });

    test('throws RANDOM_EMPTY_ITEMS when picking from an empty array', () => {
      const rng = new Random({ seed: 16 });

      expect(() => rng.pick([])).toThrow(EngineError);

      try {
        rng.pick([]);
      } catch (err) {
        expect(err).toBeInstanceOf(EngineError);
        expect((err as EngineError).code).toBe(ErrorCode.RANDOM_EMPTY_ITEMS);
      }
    });
  });

  describe('shuffle()', () => {
    test('returns the same array reference', () => {
      const rng = new Random({ seed: 17 });
      const items = [1, 2, 3, 4, 5];

      expect(rng.shuffle(items)).toBe(items);
    });

    test('preserves the multiset of elements', () => {
      const rng = new Random({ seed: 18 });
      const items = [1, 2, 3, 4, 5, 6, 7];

      rng.shuffle(items);

      expect([...items].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    test('produces a different ordering for a nontrivial input', () => {
      const rng = new Random({ seed: 19 });
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const before = [...items];
      rng.shuffle(items);

      expect(items).not.toEqual(before);
    });

    test('leaves an empty or single-element array untouched', () => {
      const rng = new Random({ seed: 20 });

      expect(rng.shuffle([])).toEqual([]);
      expect(rng.shuffle([42])).toEqual([42]);
    });
  });

  describe('inRectangle()', () => {
    test('returns a frozen point inside the rectangle', () => {
      const rng = new Random({ seed: 21 });

      for (let i = 0; i < 500; i++) {
        const p = rng.inRectangle(10, 20, 100, 50);

        expect(p.x).toBeGreaterThanOrEqual(10);
        expect(p.x).toBeLessThan(110);
        expect(p.y).toBeGreaterThanOrEqual(20);
        expect(p.y).toBeLessThan(70);
        expect(Object.isFrozen(p)).toBe(true);
      }
    });

    test('treats negative width and height as their absolute value', () => {
      const rng = new Random({ seed: 22 });

      for (let i = 0; i < 100; i++) {
        const p = rng.inRectangle(0, 0, -10, -10);

        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(10);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(10);
      }
    });
  });

  describe('inCircle()', () => {
    test('returns a frozen point inside the disc', () => {
      const rng = new Random({ seed: 23 });

      for (let i = 0; i < 500; i++) {
        const p = rng.inCircle(50, 50, 25);
        const dx = p.x - 50;
        const dy = p.y - 50;

        expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(25 + 1e-9);
        expect(Object.isFrozen(p)).toBe(true);
      }
    });

    test('returns the center when radius is 0', () => {
      const rng = new Random({ seed: 24 });
      const p = rng.inCircle(7, 9, 0);

      expect(p.x).toBe(7);
      expect(p.y).toBe(9);
    });

    test('treats a negative radius as its absolute value', () => {
      const rng = new Random({ seed: 25 });

      for (let i = 0; i < 100; i++) {
        const p = rng.inCircle(0, 0, -5);

        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(5 + 1e-9);
      }
    });
  });

  describe('inFrame()', () => {
    test('returns a frozen point inside the outer rectangle and outside the inner hole', () => {
      const rng = new Random({ seed: 230 });
      const x = 10;
      const y = 20;
      const w = 100;
      const h = 60;
      const t = 5;

      for (let i = 0; i < 1000; i++) {
        const p = rng.inFrame(x, y, w, h, t);

        // Inside outer rectangle.
        expect(p.x).toBeGreaterThanOrEqual(x);
        expect(p.x).toBeLessThanOrEqual(x + w);
        expect(p.y).toBeGreaterThanOrEqual(y);
        expect(p.y).toBeLessThanOrEqual(y + h);

        // Not strictly inside the inner hole.
        const insideHole =
          p.x > x + t &&
          p.x < x + w - t &&
          p.y > y + t &&
          p.y < y + h - t;

        expect(insideHole).toBe(false);
        expect(Object.isFrozen(p)).toBe(true);
      }
    });

    test('covers all four strips of the frame', () => {
      const rng = new Random({ seed: 231 });
      const x = 0;
      const y = 0;
      const w = 100;
      const h = 100;
      const t = 10;

      let top = 0;
      let bottom = 0;
      let left = 0;
      let right = 0;

      for (let i = 0; i < 2000; i++) {
        const p = rng.inFrame(x, y, w, h, t);

        if (p.y < t) top++;
        else if (p.y > h - t) bottom++;
        else if (p.x < t) left++;
        else if (p.x > w - t) right++;
      }

      // Every strip should be hit; a square frame has equal area on each side
      // so allow generous slack but still confirm coverage.
      expect(top).toBeGreaterThan(0);
      expect(bottom).toBeGreaterThan(0);
      expect(left).toBeGreaterThan(0);
      expect(right).toBeGreaterThan(0);
    });

    test('falls back to a full-rectangle sample when thickness fills the rect', () => {
      const rng = new Random({ seed: 232 });

      for (let i = 0; i < 100; i++) {
        // thickness * 2 === width, so the frame fills the whole rectangle.
        const p = rng.inFrame(0, 0, 10, 30, 5);

        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(10);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(30);
      }
    });

    test('clamps an over-large thickness to the fill-fallback', () => {
      const rng = new Random({ seed: 233 });

      for (let i = 0; i < 100; i++) {
        const p = rng.inFrame(0, 0, 20, 20, 999);

        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(20);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(20);
      }
    });

    test('returns the top-left corner when thickness is non-positive', () => {
      const rng = new Random({ seed: 234 });

      expect(rng.inFrame(7, 9, 100, 50, 0)).toEqual({ x: 7, y: 9 });
      expect(rng.inFrame(7, 9, 100, 50, -3)).toEqual({ x: 7, y: 9 });
    });

    test('does not consume a draw for a zero-area frame', () => {
      const a = new Random({ seed: 235 });
      const b = new Random({ seed: 235 });

      a.inFrame(0, 0, 10, 10, 0);

      // No draw was consumed by the degenerate-path early exit.
      expect(a.next()).toBe(b.next());
    });

    test('treats negative width and height as their absolute value', () => {
      const rng = new Random({ seed: 236 });

      for (let i = 0; i < 100; i++) {
        const p = rng.inFrame(0, 0, -40, -40, 5);

        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(40);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(40);
      }
    });
  });

  describe('inRing()', () => {
    test('returns a frozen point inside the annulus', () => {
      const rng = new Random({ seed: 26 });

      for (let i = 0; i < 500; i++) {
        const p = rng.inRing(0, 0, 10, 20);
        const d = Math.hypot(p.x, p.y);

        expect(d).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(d).toBeLessThanOrEqual(20 + 1e-9);
        expect(Object.isFrozen(p)).toBe(true);
      }
    });

    test('swaps min and max when min > max', () => {
      const rng = new Random({ seed: 27 });

      for (let i = 0; i < 100; i++) {
        const p = rng.inRing(0, 0, 20, 10);
        const d = Math.hypot(p.x, p.y);

        expect(d).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(d).toBeLessThanOrEqual(20 + 1e-9);
      }
    });
  });

  describe('inPolygon()', () => {
    test('returns a frozen point inside a convex polygon', () => {
      const rng = new Random({ seed: 28 });
      const triangle = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ];

      for (let i = 0; i < 200; i++) {
        const p = rng.inPolygon(triangle);

        // For this triangle, x + y must be <= 10 and both >= 0.
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.y).toBeLessThanOrEqual(10 + 1e-9);
        expect(Object.isFrozen(p)).toBe(true);
      }
    });

    test('returns a point inside a concave polygon', () => {
      const rng = new Random({ seed: 29 });
      const arrow = [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
        { x: 0, y: 10 },
        { x: 3, y: 5 },
      ];

      for (let i = 0; i < 100; i++) {
        const p = rng.inPolygon(arrow);

        // Bounding-box sanity check; full containment guaranteed by the impl.
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(10);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(10);
      }
    });

    test('returns the first vertex for a degenerate polygon (< 3 vertices)', () => {
      const rng = new Random({ seed: 30 });

      expect(rng.inPolygon([{ x: 4, y: 7 }])).toEqual({ x: 4, y: 7 });
      expect(
        rng.inPolygon([
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ]),
      ).toEqual({ x: 1, y: 1 });
    });

    test('returns (0, 0) for an empty vertex list', () => {
      const rng = new Random({ seed: 31 });

      expect(rng.inPolygon([])).toEqual({ x: 0, y: 0 });
    });

    test('falls back to the centroid for a zero-area polygon with collapsed bounds', () => {
      const rng = new Random({ seed: 32 });

      // All three points collinear on the x-axis — bounding-box height 0.
      const p = rng.inPolygon([
        { x: 0, y: 5 },
        { x: 10, y: 5 },
        { x: 5, y: 5 },
      ]);

      expect(p.y).toBe(5);
    });

    test('falls back to the centroid when rejection sampling exhausts its attempts', () => {
      const rng = new Random({ seed: 320 });

      // Zero-area polygon with a non-degenerate bounding box: every interior
      // candidate misses the line, so the rejection loop exhausts and falls
      // through to the centroid path.
      const p = rng.inPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 0 },
      ]);

      expect(Object.isFrozen(p)).toBe(true);
      // Bounding-box center, since the polygon's signed area is zero.
      expect(p).toEqual({ x: 5, y: 5 });
    });
  });

  describe('color()', () => {
    test('returns integers in [0x000000, 0xffffff] by default', () => {
      const rng = new Random({ seed: 33 });

      for (let i = 0; i < 1000; i++) {
        const c = rng.color();

        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0x000000);
        expect(c).toBeLessThanOrEqual(0xffffff);
      }
    });

    test('respects custom bounds', () => {
      const rng = new Random({ seed: 34 });

      for (let i = 0; i < 200; i++) {
        const c = rng.color(0xff0000, 0xff00ff);

        expect(c).toBeGreaterThanOrEqual(0xff0000);
        expect(c).toBeLessThanOrEqual(0xff00ff);
      }
    });

    test('clamps out-of-range bounds and swaps when min > max', () => {
      const rng = new Random({ seed: 35 });

      for (let i = 0; i < 100; i++) {
        const c = rng.color(0xffffff + 100, -50);

        expect(c).toBeGreaterThanOrEqual(0x000000);
        expect(c).toBeLessThanOrEqual(0xffffff);
      }
    });
  });

  describe('hexString()', () => {
    test('returns a string of lowercase hex characters of the requested length', () => {
      const rng = new Random({ seed: 36 });

      expect(rng.hexString(8)).toMatch(/^[0-9a-f]{8}$/);
      expect(rng.hexString(32)).toMatch(/^[0-9a-f]{32}$/);
    });

    test('returns an empty string for non-positive or non-integer lengths', () => {
      const rng = new Random({ seed: 37 });

      expect(rng.hexString(0)).toBe('');
      expect(rng.hexString(-3)).toBe('');
      expect(rng.hexString(0.4)).toBe('');
    });

    test('floors fractional lengths', () => {
      const rng = new Random({ seed: 38 });

      expect(rng.hexString(4.9)).toMatch(/^[0-9a-f]{4}$/);
    });
  });

  describe('state round-trip', () => {
    test('a generator restored from getState() resumes the same stream', () => {
      const original = new Random({ seed: 100 });

      for (let i = 0; i < 10; i++) original.next();

      const snapshot = original.getState();
      const resumed = new Random({ state: snapshot });

      for (let i = 0; i < 20; i++) {
        expect(resumed.next()).toBe(original.next());
      }
    });

    test('state overrides seed when both are supplied', () => {
      const ref = new Random({ seed: 200 });
      const captured = ref.getState();

      const rng = new Random({ seed: 999, state: captured });

      expect(rng.next()).toBe(ref.next());
    });

    test('setState() restores a previously captured state', () => {
      const rng = new Random({ seed: 300 });

      const snapshot = rng.getState();
      const expected = rng.next();

      rng.next();
      rng.next();
      rng.setState(snapshot);

      expect(rng.next()).toBe(expected);
    });

    test('setState() ignores non-finite values', () => {
      const rng = new Random({ seed: 400 });
      const snapshot = rng.getState();

      rng.setState(Number.NaN);

      expect(rng.getState()).toBe(snapshot);
    });

    test('setState() returns the generator for chaining', () => {
      const rng = new Random({ seed: 500 });

      expect(rng.setState(7)).toBe(rng);
    });

    test('a non-finite state in the constructor falls through to seed handling', () => {
      const rng = new Random({ seed: 600, state: Number.POSITIVE_INFINITY });

      // Seed handling kicked in; seed should be the 32-bit form of 600.
      expect(rng.seed).toBe(600);
    });
  });
});
