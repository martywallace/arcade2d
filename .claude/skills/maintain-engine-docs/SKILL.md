---
name: maintain-engine-docs
description: Keep the engine's JSDoc and the generated API reference site in sync whenever public engine code changes. Use this whenever you add, remove, rename, or change the signature of any exported symbol in packages/engine/src — a class, interface, type alias, enum, function, method, property, accessor, parameter, or return type — or change what a function throws. Also use when adding a new file/cluster to the engine (barrel exports), when a docblock is missing or thin, or when someone asks to "update the docs", "document this", "regenerate the API reference", or notices a doc page is wrong or missing. The API reference at /docs on the website is generated from this JSDoc via TypeDoc, so engine source edits and doc edits are the same task — not two.
---

# Maintaining the engine API documentation

## Why this matters

arcade2d is a developer-facing product: the JSDoc in `packages/engine/src`
**is** the documentation. The website's API reference (`apps/website`, served
at `/docs`) is generated from it — TypeDoc parses the engine source into
`apps/website/.typedoc/api.json`, and custom Astro pages render that model
with cross-linking, syntax-highlighted examples, and the site theme.

The practical consequence: **a public engine change is not done until its
JSDoc is updated.** There is no separate "docs pass" later. If you change a
signature, add a `@throws`, or export a new symbol, the doc site changes the
next time it builds — correctly if you wrote the docblock, wrongly (or with a
gap) if you didn't.

## When this skill applies

Trigger it for any edit under `packages/engine/src` that touches the public
surface:

- Adding / removing / renaming an exported class, interface, type alias,
  enum, function, or const.
- Adding / removing / renaming a public method, property, or accessor, or
  changing its parameters or return type.
- Changing what a function throws, or under what conditions.
- Adding a new file or directory cluster to the engine.

It does **not** apply to private/internal implementation details (leading
underscore, `private`, or `@internal`) beyond making sure they stay excluded.

## The documentation standard

Follow the project standard in `CLAUDE.md` ("Documentation expectations").
In short, every public symbol needs:

1. A one-paragraph summary explaining what it is and **why** you'd reach for
   it — not a restatement of the signature.
2. The conceptual model when there is ordering / lifecycle / state-machine /
   deferred behaviour. `World`, `Prefab`, `PrefabRegistry` are the bar.
3. `@param` for every parameter, with non-obvious constraints stated.
4. `@returns` for non-void returns.
5. `@throws` naming the `{@link ErrorCode}` on the thrown
   `{@link EngineError}`.
6. `@example` blocks of compileable TypeScript for non-trivial APIs.
7. `{@link Foo}` cross-references to every other engine symbol mentioned.

### Things that specifically affect the generated site

- **`{@link Symbol}` and `{@link Symbol.member}` become hyperlinks.** The
  renderer resolves them to `/docs/<slug>` (and `#member` anchors) by symbol
  name. Use the exact exported name. A link to a symbol that isn't part of
  the documented surface (e.g. a PIXI `Application`, `Math.cos`) silently
  renders as plain inline code — that's expected, not a bug, but prefer
  linking real engine symbols.
- **Markdown renders.** Headings (`###`), bullet lists, tables, and fenced
  code blocks all render. Fenced ` ```typescript ` blocks get Shiki syntax
  highlighting; an un-tagged fence (e.g. an ASCII diagram) renders as clean
  monospace. Use a language tag on real code.
- **A symbol is invisible until it's re-exported from a barrel.** Every
  cluster (`world/`, `geometry/`, `graphics/`, `input/`, `utils/`) has an
  `index.ts` that `export *`s its files, and `src/index.ts` re-exports the
  clusters. A new file that isn't added to its barrel produces **no doc page
  at all** — this is the most common "my docs are missing" cause.
- **The reference is grouped by source folder, not by kind.** The sidebar and
  `/docs` index group symbols into categories (Core / World / Graphics /
  Geometry / Input / Utilities) derived from the first segment of each
  symbol's source path — package-root files are "Core", `world/*.ts` is
  "World", and so on. **Adding a new top-level engine folder** (e.g.
  `audio/`) means it needs a label and a position, otherwise its symbols fall
  to the end of the list under the raw folder name. Register it in
  `apps/website/src/lib/api/load.ts` by adding an entry to both
  `CATEGORY_LABELS` (folder → display name) and `CATEGORY_ORDER` (where it
  sits in the sequence). Symbols still sort within a category by kind
  (classes/enums first), so no per-symbol annotation is needed.
- **`@internal` removes a symbol from the docs.** TypeDoc runs with
  `excludeInternal` + `excludePrivate`. Use `@internal` (or `private`) to keep
  implementation detail out of the reference rather than relying on it being
  "obviously internal."

## Workflow

When you make a qualifying engine change:

1. **Land the code change** in `packages/engine/src`.
2. **Write/update the JSDoc** to the standard above, in the same edit. Don't
   defer it.
3. **If you added a new file**, add it to its cluster's `index.ts` barrel (and
   confirm the cluster is re-exported from `src/index.ts`).
4. **Regenerate and verify the API model:**
   ```bash
   yarn workspace @arcade2d/website docs:api
   ```
   Read the TypeDoc output. `Failed to resolve link` warnings for engine
   symbols mean a broken `{@link}` (typo or missing export) — fix those.
   Warnings for external names (PIXI, lib.dom) are fine to ignore.
5. **Build the docs site** to confirm the pages render and routes resolve:
   ```bash
   yarn workspace @arcade2d/website build
   ```
   This regenerates the model and emits a page per exported symbol under
   `dist/docs/`. A new symbol should produce `dist/docs/<kebab-name>/`.
6. **Spot-check** the affected page(s) — e.g. with the website preview — to
   confirm the summary, params, throws, examples, and cross-links render as
   intended.

## How the pipeline fits together (reference)

- `apps/website/typedoc.json` — points TypeDoc at
  `packages/engine/src/index.ts` using the engine's tsconfig; emits
  `apps/website/.typedoc/api.json`.
- `apps/website/src/lib/api/` — loads the JSON, builds the symbol/link index,
  and renders comments (Markdown + `{@link}` resolution via `marked`), types,
  and signatures.
- `apps/website/src/pages/docs/` — the `/docs` index and `/docs/[slug]` pages.
- The website `build`/`dev` scripts run `docs:api` before Astro, so a normal
  `yarn build` always regenerates from current engine source. The
  `.typedoc/` directory is gitignored — it's a build artifact, never edited
  by hand.

## What not to do

- Don't hand-edit `.typedoc/api.json` or anything under `dist/` — they're
  generated.
- Don't document a change by editing the website pages instead of the engine
  JSDoc. The JSDoc is the source of truth; the pages are derived.
- Don't relax `excludeInternal`/`excludePrivate` to surface a symbol — if it
  should be public, export it properly and document it; if not, leave it out.
