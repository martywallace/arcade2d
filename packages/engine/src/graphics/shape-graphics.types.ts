import type { GraphicsOptions } from './abstract-graphics.types';

/**
 * Construction-time configuration for the shape graphics components
 * ({@link CircleGraphics}, {@link PolygonGraphics}). The fill colour is a
 * positional constructor argument; this bag carries the remaining shared
 * visual options ({@link GraphicsOptions.alpha} and
 * {@link GraphicsOptions.visible}).
 */
export type ShapeGraphicsOptions = GraphicsOptions;
