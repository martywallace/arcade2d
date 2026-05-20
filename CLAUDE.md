# arcade2d — Claude Code project guide

This file is project-wide context loaded automatically every session.

## What this repo is

arcade2d is a TypeScript 2D game engine, plus the tooling around it. It is a
**developer-facing product**: third-party game developers will read the
generated JSDoc, look at the example demos, and lean heavily on autocomplete
hover-tips to learn how to use the engine. The quality of the documentation is
part of the product, not separate from it.

The long-term vision is engine + editor + dev server (see Marty's 2024 blog
post on the topic). Today the repo contains:

- **`packages/engine`** — the engine itself. The thing users will install.
- **`packages/eslint-config`** and **`packages/tsconfig`** — shared dev configs.
- **`demos/td-shooter`** — a top-down shooter that exercises the engine. The
  demo doubles as a smoke test and as living documentation of "what idiomatic
  arcade2d code looks like."
- **`apps/devserver`** — the dev-server / editor surface, in progress.

The repo is a Yarn 4 workspaces monorepo orchestrated by Turborepo
(`turbo.json` at the root). Scripts at the root level (`yarn build`,
`yarn typecheck`, `yarn lint`, `yarn test`) fan out across all workspaces; the
per-workspace scripts use the same names so `yarn workspace @arcade2d/engine
test` works the same way.

## Documentation expectations

Because this is a developer-facing product, **every public engine API needs
thorough JSDoc** — meaning every exported class, function, interface, type,
method, and property in `packages/engine/src` that ends up in the package's
`exports` surface. When in doubt, write more docs, not less.

A complete public-API docblock has:

1. **A one-paragraph summary** explaining what the thing is and what it's for.
   Not just what it does mechanically — _why someone would reach for it_.
2. **The conceptual model**, when there is one. If the behaviour involves
   ordering, lifecycle, state machines, deferred semantics, or any other
   "you need to understand this to use it correctly" detail, spell it out.
   Marty's `World` class docblock is the reference example.
3. **`@param` entries for every parameter**, each one stating what it is and
   any non-obvious constraint (e.g. "must be a positive integer," "cloned
   on construction so external mutation does not leak in").
4. **`@returns`** for non-void return values.
5. **`@throws`** when the function can throw — including the
   {@link ErrorCode} that will be on the thrown {@link EngineError}.
6. **`@example` blocks** for any non-trivial API. Examples should be
   compileable TypeScript that a user could paste into their own code.
   Single-line `@example` snippets are fine for small APIs; longer
   block-style examples are appropriate for class-level docs that introduce
   a new concept.
7. **`{@link Foo}` cross-references** to related types. JSDoc tooling renders
   these as hyperlinks; they are the primary navigation mechanism for
   someone exploring the API surface via their editor. Cross-reference
   liberally — every mention of another class or interface in the same
   package should be a `{@link}`.

### What you do _not_ need to document

- **Private and internal methods.** A leading underscore (`_doSomething`) or
  `private` modifier signals "implementation detail." These should have an
  inline `//` comment explaining _why_ the code does what it does when the
  intent isn't obvious, but they do not need formal JSDoc.
- **Trivially-named getters/setters** whose name fully describes their
  contract. `public get count(): number` doesn't need three paragraphs.
- **Tests.** `.spec.ts` files describe behaviour through their `describe` /
  `test` names; that _is_ the documentation.

### Writing style

- **Explain the why, not just the what.** "Captures `now` once so the
  timestamp threaded into Update is the same one stored as `_lastUpdate` for
  the next frame" is a useful comment; "captures the current time" is not.
- **Be direct.** The audience is experienced TypeScript developers. Don't
  over-qualify, don't soften, don't pad. State the constraint.
- **No emoji in code or docs** unless explicitly requested by the user.
- **Use Markdown inside docblocks** where it helps — headings (`### ...`),
  bullet lists, fenced code blocks, tables. JSDoc tooling renders them.
- **Cross-link to ErrorCodes** when documenting `@throws`. The error code is
  part of the public contract.

### Module-level / class-level docblocks

For non-trivial classes (anything with state, lifecycle, or multiple
collaborators), write a substantial class-level docblock that:

- Introduces the class's role in the system.
- Explains the lifecycle / phases / ordering rules.
- Gives a worked example showing a typical use.
- Cross-references the collaborators (other classes the user will need to
  understand to use this one).

The `World`, `Prefab`, and `PrefabRegistry` class docblocks in
`packages/engine/src/world/` are the bar. Match or exceed that level of
context for any new top-level public class.

## Code conventions

- **TypeScript is strict.** `noUncheckedIndexedAccess`,
  `noImplicitReturns`, `strict`, etc. Don't relax the config to make code
  compile — fix the code instead. Marty has a documented preference for
  this; see `~/.claude/projects/-Users-marty-work-arcade2d-arcade2d/memory`.
- **Errors are codified.** Engine errors go through `throwEngineError(code,
message, context)` with a code from the `ErrorCode` enum in
  `packages/engine/src/error.ts`. Add a new code there before throwing a
  new class of error; do not throw raw `Error` instances from engine code.
- **Per-component error isolation.** Engine code that drives component
  callbacks (e.g. `World.update`, `WorldObject._runComponentPhase`) wraps
  each invocation in try/catch and routes failures through
  `World.reportError`. Match this pattern in any new engine code that
  invokes user callbacks.
- **Immutability where it doesn't cost performance.** Use `readonly` on
  fields and types liberally. Use `as const`, frozen options objects, etc.
  Where mutability is intentional (e.g. component-internal state, game
  loop hot paths), it's fine to skip.
- **No comments at the top of files describing the file.** Use class- or
  symbol-level JSDoc instead so it shows up in tooling.

## Testing

- Tests are **colocated** with the code: `foo.ts` is tested by
  `foo.spec.ts` in the same directory.
- Test runner is Jest, configured in each package's `package.json`.
- `describe` blocks group tests by method or concept. `test` blocks name
  the _behaviour_ being asserted, not the method being called. Example:
  `test('throws COMPONENT_AMBIGUOUS_TYPE when multiple components of the
type are registered', ...)`.
- **New public APIs require tests.** Cover the happy path, the throwing
  paths (with the specific `ErrorCode` asserted), and any non-obvious
  edge cases (re-entrancy, idempotence, ordering invariants).
- Aim for 100% line coverage on new files. The coverage report is part of
  `yarn workspace @arcade2d/engine test`.

## Workspace commands

Most operations should be issued from the repo root and let Turborepo
fan them out:

| Command                                 | What it does                               |
| --------------------------------------- | ------------------------------------------ |
| `yarn build`                            | Build every workspace                      |
| `yarn typecheck`                        | Run `tsc --noEmit` across every workspace  |
| `yarn lint`                             | ESLint across every workspace              |
| `yarn test`                             | Jest across every workspace                |
| `yarn workspace @arcade2d/engine <cmd>` | Run `<cmd>` only in the engine             |
| `yarn demo:td-shooter`                  | Run the td-shooter demo against the engine |

The demos' `dev` script invokes `yarn workspace @arcade2d/root exec turbo run
build --filter=...^...` before starting Vite, so the demo always runs against
freshly-built engine dist. Don't change that incantation casually — getting
turbo to run from the right workspace context took some doing.

## Style + formatting

- **Prettier** formats everything (`yarn format` to fix,
  `yarn format:check` to verify).
- **ESLint** via the shared `@arcade2d/eslint-config` package.
- **2-space indent**, **single quotes**, **trailing commas where valid**,
  **semicolons**. Prettier enforces all of this.

## When making code changes

1. Land the code change.
2. Write or update tests that prove it works.
3. Write or update the JSDoc to the standard above. Don't skip this step
   even on internal-feeling work — public-API docs are part of the
   feature.
4. Run `npx tsc --noEmit`, `yarn jest`, and (for the demos) verify the
   demo still typechecks against the new engine.
5. If you added a new public symbol, make sure it's re-exported from the
   relevant barrel file (`src/index.ts` or a nested `index.ts`) — many
   features are silently invisible until they are.

## What _not_ to do

- **Don't relax `tsconfig.json` or `.eslintrc` rules** to make code
  compile/lint. Fix the code instead. If a rule is genuinely wrong for
  the project, raise it before changing it.
- **Don't add documentation-shaped fluff.** Docblocks that just restate
  the function signature in prose are noise. If you don't have anything
  to add beyond what the type says, link to a related concept or skip the
  docblock.
- **Don't introduce raw `Error` throws in engine code.** Use
  `throwEngineError` with an appropriate `ErrorCode`.
- **Don't bypass the prefab build token.** `Prefab.buildObject` is gated
  by `PREFAB_BUILD_TOKEN` for a reason; callers should go through
  `World.createFromPrefab` or `World.createFromPrefabName`.
- **Don't commit to `main` without being asked.** Marty drives commits;
  ask first or wait for the request.
