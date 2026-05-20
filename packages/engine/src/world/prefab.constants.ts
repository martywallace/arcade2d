/**
 * Token required by {@link Prefab.buildObject}. Held privately by the engine;
 * {@link World.createFromPrefab} and {@link World.createFromPrefabName} pass
 * it through when materialising objects. Any other caller would have to
 * manufacture this symbol value, which is impossible without access to this
 * module.
 *
 * Think of this as a lightweight `friend` declaration: types stay public for
 * legibility, but the actual call sites are restricted to engine code.
 *
 * @internal
 */
export const PREFAB_BUILD_TOKEN: unique symbol = Symbol(
  'arcade2d:prefab-build',
);
