---
name: authoring-engine-component
description: Write a new arcade2d engine component (a class extending AbstractWorldComponent or AbstractWorldObjectComponent) correctly end to end. Use this whenever you add a component to packages/engine/src — anything that attaches to a World or a WorldObject and ticks through the update loop — or when reviewing/fixing one. Covers tier choice (world vs object), which lifecycle hook to use, declaring dependencies with resolveDependencies, and especially writing a correct, idempotent onDestroy that releases every resource the component allocated (Pixi display objects, Rapier bodies, Web Audio nodes, event listeners). Also use when the task is "make a component", "add a system", "this component leaks", or "its destroy is wrong".
---

# Authoring an engine component

## Why this matters

Components are the engine's unit of behaviour. A half-correct one compiles,
passes a happy-path test, and then leaks Pixi/WASM/Web-Audio resources on world
teardown, double-frees on a second destroy, or silently never runs because it
was never added to a barrel. None of those show up in a typecheck. This skill
is the checklist that makes a component correct on the first pass.

Read `CLAUDE.md` for the repo-wide rules (file organization, JSDoc standard,
error isolation, `throwEngineError`). This skill is the component-specific
procedure layered on top.

## 1. Pick the tier

Two object-facing bases, both extend `AbstractComponent`:

- **`AbstractWorldComponent`** (`world/abstract-world-component.ts`) — host is
  the `World`. Use for world-scoped *systems and services*: physics worlds,
  spawners, the scene/camera, anything there's one of per world. Exposes
  `this.host`/`this.world` (identical at this tier) and `this.game`.
- **`AbstractWorldObjectComponent`** (`world/abstract-world-object-component.ts`)
  — host is a `WorldObject`. Use for *per-object* behaviour and visuals:
  graphics, rigid bodies, controllers. Exposes `this.host` (the object),
  `this.world` (hops through the host), and `this.game`.

Decision rule: does it own per-object state/transform/visual, or a world-wide
service? If you'd want exactly one regardless of object count, it's world-tier.

There is also `AbstractGameComponent` for page-scoped services on the `Game`
(input samplers, audio engine, asset library). New game components are rare —
only reach for it for genuinely page-global, world-outliving services.

## 2. Implement the right lifecycle hooks

The `Component` interface (`components.types.ts`) defines five hooks. **Only
`onAdded`, `onUpdate`, and `onDestroy` are required**; `onPreUpdate` and
`onPostUpdate` are optional — omit them entirely rather than writing an empty
body (the engine skips absent hooks at a single property read, so an empty hook
is pure overhead). Every hook receives the component's resolved `deps` as its
trailing argument; the update hooks also receive the `WorldUpdate`.

| Hook | When | Use it for |
| --- | --- | --- |
| `onAdded(deps)` | once, when attached (before first tick) | acquire resources: parent a Pixi display, create a Rapier body, allocate a buffer. Capture the deps/handles you'll need to release later. |
| `onPreUpdate(update, deps)` | start of tick, before any `onUpdate` anywhere | **sample** state others read this tick (input snapshot, clear last frame's overlap set). |
| `onUpdate(update, deps)` | main phase | the actual per-frame work: behaviour, movement, stepping the sim. |
| `onPostUpdate(update, deps)` | after every `onUpdate` | **react** to the settled frame: camera follows the already-moved player, graphics sync the host transform into the display object. |
| `onDestroy(deps)` | once, on removal/teardown | release everything `onAdded` acquired. See §4. |

Phase rule: every host finishes a phase before any host starts the next, and
world-tier components run before object-tier within each phase. If your
component reads another's output, read it in a *later* phase than the one that
produces it (the classic post-update camera/graphics pattern).

The `enabled` flag (defaults `true`) gates the three update hooks only —
`onAdded`/`onDestroy` always fire, so a disabled component is still cleanly torn
down. Don't reimplement an enable gate; set `this.enabled`.

## 3. Declare dependencies (don't fetch ad hoc)

If the component needs sibling or world components, implement the optional
`resolveDependencies(resolver)` and return a typed deps object — don't reach
through `this.host.getComponentByType(...)` inside `onUpdate`.

- Object-tier resolver exposes `requireSibling` / `optionalSibling` and
  `requireFromWorld` / `optionalFromWorld`.
- World-tier resolver exposes `requireSibling` / `optionalSibling`.
- `require*` throws a codified `EngineError` when the dependency is missing or
  ambiguous; `optional*` returns `null`. Pick by whether the component can
  function without it.

Define the deps shape as a sibling type (e.g. `MyThingDeps`) and thread it
through the base's generic so every hook is typed. `resolveDependencies` runs
before any `onAdded`; do **not** call `addComponent` from inside it (the engine
rejects re-entrant adds).

## 4. Write a correct `onDestroy` — the part that's usually wrong

This is the recurring bug class. A component that allocates anything must give
it all back, exactly once, in the right order:

1. **Call `super.onDestroy(deps)` first** if your base or a superclass owns
   teardown (e.g. `AbstractGraphics.onDestroy` unparents and destroys the Pixi
   display object). Release *its* resources before yours, then add yours.
2. **Release every resource `onAdded` acquired** — Pixi `Container`/`Graphics`
   (`removeChild` then `.destroy()`), Rapier bodies/colliders (deregister from
   the `PhysicsWorld`), Web Audio nodes (`disconnect`/`stop`), and **event
   listeners** (a forgotten listener keeps the whole component alive). The
   leak-hardening pass added exactly these: `AudioInstance.destroy` clears its
   ended-listeners, `Texture.destroy` disposes the framed wrapper.
3. **Null out the handles** (`this._body = null`, etc.) so a stray later call
   can't touch freed memory.
4. **Be idempotent.** `onDestroy` may run during a normal removal and again on
   world teardown. Guard with the nulled handle (`if (!this._body) return`) or a
   `_freed` flag — `PhysicsWorld` guards its post-free methods this way so a
   second teardown is a clean no-op, not a WASM crash.

Mirror the existing references: `AbstractGraphics.onDestroy`, `RigidBody`'s
body/collider teardown, `PhysicsWorld`'s `_freed` guard.

## 5. Errors go through the engine's channels

- Throw with `throwEngineError(code, message, context)` using an `ErrorCode`
  from `error.constants.ts` — never a raw `Error`. Add a new code there first if
  none fits, and document it on the enum member (it's part of the public
  contract).
- You do **not** wrap your own hooks in try/catch for the loop's sake — the host
  already isolates each component invocation and routes throws through
  `_reportPhaseError` (World → `reportError`/`onError`; WorldObject → its world;
  Game → `console.error`). Just throw cleanly; the loop survives.

## 6. Wire it up (or it's invisible)

1. **One class per file, kebab-case filename** matching the class name; deps
   type in `<name>.types.ts`, constants in `<name>.constants.ts` — per CLAUDE.md.
2. **Add the file to its cluster's `index.ts` barrel.** A component that isn't
   re-exported is silently absent from the package surface — and, as the
   geometry init-cycle bug showed, barrel wiring can have load-order
   consequences too.
3. **Tests** (`<name>.spec.ts`, colocated): happy path, each throwing path with
   the specific `ErrorCode` asserted, and the non-obvious cases — idempotent
   destroy, re-entrancy, ordering. Aim for 100% lines on the new file.
4. **JSDoc to the CLAUDE.md standard** — class-level docblock with the
   conceptual model and a worked `@example`, `{@link}` cross-refs to
   collaborators, `@throws` naming the `ErrorCode`. This triggers
   `maintain-engine-docs`.

## 7. Verify

`npx tsc --noEmit` + `yarn jest` for the unit layer. But components touch the
render/sim runtime that jest can't see — if the component is exercised by a
demo, **also build the engine and run that demo through the preview tools** (see
the `verify-engine-change-in-demo` skill). Tests passing is necessary, not
sufficient.
