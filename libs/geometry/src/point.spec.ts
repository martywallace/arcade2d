import { Point } from './point';

describe('Point', () => {
  describe('length', () => {
    test('It will calculate the length', () => {
      const point = new Point(5, 8);

      expect(point.length()).toBeCloseTo(9.43398, 5);
    });
  });
});
