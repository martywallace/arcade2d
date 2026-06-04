import type { TexturedGraphicsOptions } from './abstract-textured-graphics.types';

/**
 * Construction-time configuration for a {@link Sprite}. A sprite adds nothing
 * beyond the shared textured-graphics surface, so this is exactly
 * {@link TexturedGraphicsOptions} — `anchor`, `tint`, `alpha`, and `visible`,
 * each optional and taking its documented default.
 */
export type SpriteOptions = TexturedGraphicsOptions;
