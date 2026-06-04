---
name: verify-engine-change-in-demo
description: Verify an engine change actually works at runtime by building the engine and exercising a demo in the browser preview — the check that yarn test cannot do. Use this after changing packages/engine/src in any way that affects what runs in a browser: geometry, graphics, the bundling/module structure (barrels, import cycles, new files), the update loop, physics, input, or audio. The engine's Jest suite runs under CommonJS and never sees the bundled esbuild output, so it cannot catch tree-shaking, module-init-order, or render/sim runtime bugs. A change that is green on tests, typecheck, lint, and docs can still break a demo. This skill is how you catch that before the user does.
---

# Verifying an engine change against a demo

## Why this matters

The engine ships as a bundled `dist/index.mjs` (tsup/esbuild, `treeshake: true`,
`sideEffects: false`). The Jest suite, by contrast, runs the TypeScript sources
under CommonJS via ts-jest. **They are different execution models.** A whole
class of bugs lives only in the bundle:

- Tree-shaking dropping a side-effecting import.
- esbuild's lazy `__esm` module initializers running in the wrong order, or
  never running — leaving an exported binding `undefined` (the geometry
  `Rectangle is not a constructor` bug: 747 tests green, demo broken). See the
  `project-geometry-eager-init` memory.
- Anything that only manifests when Pixi renders, Rapier steps, or the ticker
  drives the loop.

Tests, typecheck, lint, and docs being green is **necessary, not sufficient**.
For browser-observable engine changes, the runtime check is part of "done."

## When to run it

After an engine change touching: geometry, graphics, the **module structure**
(barrels, new files, import cycles, anything that could change bundle init
order), the update loop, physics, input, or audio. Skip it only for changes
with no browser-observable effect (pure types, internal refactors proven by
tests, tooling).

Pick the demo that exercises the code you touched:

| You changed… | Run… |
| --- | --- |
| geometry, shapes, physics, colliders | `physics-playground` |
| sprites, textures, tiling, text, tilesets | `dungeon-crawler` |
| basic shape graphics, world/object loop, input | `simple-shooter` |

When a change is bundling-structural (could affect *any* consumer), run a demo
that constructs the affected types directly — the physics demo's
`new Rectangle(...)` colliders are what surfaced the geometry bug.

## The workflow

1. **Rebuild the engine** so the demo runs against fresh dist (the preview
   launch configs run Vite directly and do not rebuild the engine for you):
   ```bash
   yarn workspace @arcade2d/engine build
   ```
   Re-run this after every engine source edit during the debug loop.

2. **Start the demo** via the preview tools (never `yarn dev`/Bash for servers).
   The demos are registered in `.claude/launch.json` (`physics-playground`,
   `dungeon-crawler`, `simple-shooter`). Use `preview_start` with that name.

3. **Check for errors first.** `preview_console_logs` (level `error`). Note the
   log buffer **persists across reloads** — after a fix + reload, stale
   pre-fix errors remain in the buffer, so judge success by *live state*, not by
   the presence of old error lines.

4. **Inspect live runtime state**, don't just eyeball a screenshot. Demos with
   `debug: true` expose the game on `window.game`. Use `preview_eval` to assert
   the things that should be true:
   ```js
   const w = window.game.activeWorld;
   // every object actually got its components attached?
   w._objects.filter(o => [...o._componentEntries()].length === 0).length // expect 0
   // scene graph populated?
   window.game.application.stage.children[0].children.length
   ```
   Component-less objects, an empty scene container, or a wrong object count are
   the fingerprints of factories throwing inside the world's per-component error
   isolation (which swallows the throw and logs it) — exactly how the geometry
   bug hid.

5. **Confirm visually** with `preview_screenshot` once state checks pass.

6. **If broken, diagnose against the bundle.** For "X is not a constructor" /
   undefined-binding symptoms, grep the built `dist/index.mjs` for the esbuild
   `init_*()` calls and confirm the lazy initializers run eagerly and in
   dependency order (base class before subclass). Edit *source*, rebuild,
   reload, re-check — never hand-edit dist.

## What good looks like

Live state assertions pass (zero component-less objects, populated scene graph,
expected counts), no *new* console errors, and the screenshot matches intent.
Then the engine change is verified — finish with the standard `yarn test` /
`yarn typecheck` / `yarn lint` and, for public-API changes, `maintain-engine-docs`.
