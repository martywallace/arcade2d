import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { Layer } from './layer';
import { LayerSet } from './layer-set';

function expectEngineError(fn: () => unknown, code: ErrorCode): void {
  let caught: unknown;

  try {
    fn();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(EngineError);
  expect((caught as EngineError).code).toBe(code);
}

describe('LayerSet', () => {
  describe('construction', () => {
    test('mints one Layer per name, in declaration order', () => {
      const set = new LayerSet(['ground', 'characters', 'ui']);

      expect(set.layers).toHaveLength(3);
      expect(set.layers.map((layer) => layer.name)).toEqual([
        'ground',
        'characters',
        'ui',
      ]);
      expect(set.layers.map((layer) => layer.order)).toEqual([0, 1, 2]);
      expect(set.layers.every((layer) => layer instanceof Layer)).toBe(true);
    });

    test('throws LAYER_SET_EMPTY when given no names', () => {
      expectEngineError(() => new LayerSet([]), ErrorCode.LAYER_SET_EMPTY);
    });

    test('throws LAYER_DUPLICATE_NAME when a name repeats', () => {
      expectEngineError(
        () => new LayerSet(['ground', 'ui', 'ground']),
        ErrorCode.LAYER_DUPLICATE_NAME,
      );
    });
  });

  describe('get', () => {
    test('resolves a declared name to its token', () => {
      const set = new LayerSet(['ground', 'characters']);

      const characters = set.get('characters');

      expect(characters.name).toBe('characters');
      expect(characters.order).toBe(1);
      // Same call returns the same identity, not a fresh token.
      expect(set.get('characters')).toBe(characters);
    });

    test('throws LAYER_NOT_IN_SET for an undeclared name', () => {
      const set = new LayerSet(['ground']);

      expectEngineError(
        () => (set as LayerSet).get('nope'),
        ErrorCode.LAYER_NOT_IN_SET,
      );
    });
  });

  describe('has / names / layers', () => {
    test('has reports declared membership', () => {
      const set = new LayerSet(['ground', 'ui']);

      expect(set.has('ground')).toBe(true);
      expect(set.has('missing')).toBe(false);
    });

    test('names lists the layers back-to-front', () => {
      const set = new LayerSet(['ground', 'structures', 'ui']);

      expect(set.names).toEqual(['ground', 'structures', 'ui']);
    });
  });

  describe('owns', () => {
    test('recognises its own tokens', () => {
      const set = new LayerSet(['ground', 'ui']);

      expect(set.owns(set.get('ground'))).toBe(true);
    });

    test('rejects a token from a different set with the same names', () => {
      const a = new LayerSet(['ground', 'ui']);
      const b = new LayerSet(['ground', 'ui']);

      // Structurally identical, but minted by a different set.
      expect(a.owns(b.get('ground'))).toBe(false);
    });
  });
});
