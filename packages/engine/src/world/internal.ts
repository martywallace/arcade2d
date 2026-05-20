/**
 * Module-private symbols used by the engine to gate calls between collaborating
 * internal classes. The file is deliberately **not** re-exported from the
 * package's barrel (`src/index.ts`), and the package's `exports` map only
 * surfaces `.` — so engine-external code has no path to import these symbols
 * and therefore cannot satisfy the runtime checks they guard.
 *
 * Think of this as a lightweight `friend` declaration: types stay public for
 * legibility, but the actual call sites are restricted to engine code.
 */

/**
 * Token required by {@link Prefab.buildObject}. Held privately by the engine;
 * `World.createFromPrefab` and `World.createFromPrefabName` pass it through
 * when materialising objects. Any other caller would have to manufacture this
 * symbol value, which is impossible without access to this module.
 */
export const PREFAB_BUILD_TOKEN: unique symbol = Symbol(
  'arcade2d:prefab-build',
);

export type PrefabBuildToken = typeof PREFAB_BUILD_TOKEN;
