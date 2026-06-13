import { EngineError } from '../error';
import { ErrorCode } from '../error.constants';
import { LayerSet } from './layer-set';
import { defineLayers } from './layer-set.support';

describe('defineLayers', () => {
  test('returns a LayerSet carrying the names in order', () => {
    const layers = defineLayers('ground', 'structures', 'characters', 'ui');

    expect(layers).toBeInstanceOf(LayerSet);
    expect(layers.names).toEqual(['ground', 'structures', 'characters', 'ui']);
  });

  test('the returned set resolves its names with get', () => {
    const layers = defineLayers('ground', 'ui');

    expect(layers.get('ground').order).toBe(0);
    expect(layers.get('ui').order).toBe(1);
  });

  test('each call mints an independent set', () => {
    const a = defineLayers('ground');
    const b = defineLayers('ground');

    expect(a.owns(b.get('ground'))).toBe(false);
  });

  test('throws LAYER_DUPLICATE_NAME when a name repeats', () => {
    let caught: unknown;

    try {
      defineLayers('ground', 'ground');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EngineError);
    expect((caught as EngineError).code).toBe(ErrorCode.LAYER_DUPLICATE_NAME);
  });
});
