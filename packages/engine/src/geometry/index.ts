import { Circle } from './circle';
import { Polygon } from './polygon';
import { Rectangle } from './rectangle';

/**
 * Forces eager, dependency-ordered initialisation of the shape modules.
 *
 * The shape classes form an import cycle: `Rectangle extends Polygon`, and both
 * `Circle` and `Polygon` reach the shared intersection helper, which imports
 * `Circle` and `Polygon` back. The bundler resolves the cycle with lazy
 * per-module initialisers, and the `export *` re-exports below do **not** run
 * them — so without this the exported `Rectangle` binding can stay
 * uninitialised until the first runtime `getBoundingBox()` call happens to
 * trigger its initialiser, making an otherwise-valid `new Rectangle(...)` throw
 * "Rectangle is not a constructor".
 *
 * Referencing the constructors in this exported tuple is a side effect the
 * bundler cannot tree-shake away, so it wires `Polygon`, `Rectangle`, and
 * `Circle`'s initialisers into eager module-load order. `Polygon` is listed
 * first because `Rectangle` extends it and must initialise after it.
 *
 * @internal
 */
export const SHAPE_CONSTRUCTORS = [Polygon, Rectangle, Circle] as const;

export * from './circle';
export * from './intersection.support';
export * from './matrix';
export * from './matrix.types';
export * from './point';
export * from './point.types';
export * from './polygon';
export * from './polygon.types';
export * from './rectangle';
export * from './shape.types';
