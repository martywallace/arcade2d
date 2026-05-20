---
name: wrap-library-component
description: How to build a first-party arcade2d Component that wraps a third-party library (PIXI, a physics engine, an audio lib, a tweening lib, etc.) using composition. Use this whenever the user asks to create or refactor an engine Component that delegates to an external library — including any Graphics/Sprite/Texture/Body/Collider/AudioSource/Tween-style component, or anything else where the underlying behavior comes from a dependency rather than from arcade2d's own code. Also use this when adapting existing inheritance-based components (e.g. SimpleGraphics, Scene) to the composition pattern. Trigger even if the user just says "wrap pixi", "expose a raw accessor", or "build a component around X library" without naming the pattern explicitly.
---

# Wrapping a third-party library in an arcade2d Component

## Why this pattern exists

arcade2d is a developer-facing product. Consumers will read our public types,
hover-doc our methods in their editor, and learn the engine through that
surface. If we re-export Pixi's API verbatim — or worse, inherit from a Pixi
class so a user receives a `Graphics` masquerading as our own — then Pixi's
naming choices, lifecycle assumptions, and breaking changes become arcade2d's
public contract. A v9 Pixi redesign would silently become a breaking change
for every arcade2d user.

The cure is composition with a controlled escape hatch:

1. **Bury the external instance privately.** It is an implementation detail.
2. **Expose a narrow, opinionated API surface** consistent with the rest of
   the engine's conventions — naming, units, mutability rules, lifecycle.
3. **Offer a single `raw` accessor** for power users who need something the
   surface doesn't cover, with a JSDoc warning that makes the risk explicit:
   touching `raw` opts out of arcade2d's stability guarantees.

This way, the **engine** absorbs upstream churn — consumers only break if the
arcade2d surface itself changes, which we control.

## When this skill applies

Use this skill any time the underlying behavior of a new Component comes from
an external library rather than from arcade2d's own code. Typical cases:
graphics (Pixi `Graphics`/`Sprite`/`Text`), physics (`Body`/`Collider`/`World`
from a physics lib), audio (Web Audio nodes, Howler sources), tweens,
particles, spine/skeletal animation, networking transports.

If the Component is pure arcade2d logic (a player controller, an AI behavior,
a cooldown tracker), this skill does **not** apply — write a plain Component
without the wrapping ceremony.

## Project conventions you must already follow

These come from `CLAUDE.md` at the repo root and apply to *every* engine
change, not just this skill:

- TypeScript is strict; do not relax `tsconfig.json` to compile — fix the
  code.
- All engine errors go through `throwEngineError(code, message, context)`
  with a code from `ErrorCode` in `packages/engine/src/error.ts`. Add a new
  code there before throwing a new class of error.
- Public APIs need thorough JSDoc — one-paragraph summary, conceptual model,
  `@param` for every parameter with constraints, `@returns`, `@throws` with
  `{@link ErrorCode}`, `@example` for non-trivial APIs, `{@link}`
  cross-references to related types.
- Tests are colocated as `foo.spec.ts`, cover happy path + thrown
  `ErrorCode`s + non-obvious edge cases, aim for ~100% line coverage on new
  files.
- Re-export new public symbols from the relevant barrel (`src/index.ts` or a
  nested `index.ts`) — they are silently invisible to consumers until you do.

## The shape of a wrapping component

A wrapping component is a regular `Component<THost>` (or `WorldComponent` /
`WorldObjectComponent` if it declares dependencies) with four ingredients:

1. **A private field holding the external instance.** Named with a leading
   underscore and `readonly` when possible. The class does **not** extend the
   external type.
2. **A `raw` accessor (getter)** returning that instance, with a standardized
   JSDoc warning block. This is the escape hatch.
3. **Proxy methods and properties** for the core functionality, named to
   match arcade2d's conventions, accepting/returning arcade2d's own types
   where applicable (e.g. `Point` rather than Pixi's `PointData`,
   `Rectangle` rather than `IRect`).
4. **Lifecycle hooks** that own attaching/detaching the external instance to
   whatever it needs to be attached to (a scene graph, a physics world, an
   audio context) and that sync host state (position, rotation, scale) into
   it at the right phase.

### Skeleton

Copy this and adapt — every wrapping component will look structurally like
it. The example wraps Pixi's `Sprite` for illustration; substitute the
library type and method names for your case.

```typescript
import { Sprite as PixiSprite, Texture } from 'pixi.js';
import { Component } from '../components';
import { WorldObject } from '../world';
import { Scene } from './scene';

/**
 * A textured 2D image attached to a {@link WorldObject}. Wraps a Pixi
 * `Sprite` internally; its position, rotation, and scale are driven by
 * the host's transform once per frame.
 *
 * ### Lifecycle
 *
 * On {@link onAdded} the sprite is parented to the world's {@link Scene}.
 * On {@link onPostUpdate} the host transform is copied into it so that
 * rendering reflects every behavior change made earlier in the tick. On
 * {@link onDestroy} the sprite is detached from the scene and its GPU
 * resources released.
 *
 * @example
 * ```ts
 * const player = world.createObject();
 * player.addComponentFromFactory('sprite', (host) =>
 *   new Sprite(host, Texture.from('player.png')),
 * );
 * ```
 */
export class Sprite implements Component<WorldObject> {
  private readonly _sprite: PixiSprite;
  private readonly _scene: Scene;

  constructor(public readonly host: WorldObject, texture: Texture) {
    this._sprite = new PixiSprite(texture);
    this._sprite.anchor.set(0.5, 0.5);
    this._scene = host.world.getComponentByType(Scene);
  }

  /**
   * Direct access to the underlying Pixi `Sprite` instance.
   *
   * **Use with care.** `raw` is an intentional escape hatch for cases the
   * arcade2d API doesn't cover — custom shaders, filter chains, advanced
   * blend modes, anything we haven't decided how to model yet. Code that
   * touches `raw` is coupled to Pixi's public API and may break when:
   *
   * - arcade2d upgrades Pixi (including minor versions).
   * - Pixi itself ships a breaking change.
   * - arcade2d swaps Pixi for a different renderer.
   *
   * None of those will be treated as breaking changes to arcade2d's own
   * surface. Prefer the typed methods on this component; reach for `raw`
   * only when no equivalent exists, and isolate the access behind your
   * own helper so the coupling is in one place.
   */
  public get raw(): PixiSprite {
    return this._sprite;
  }

  /**
   * The width of the sprite in world units.
   */
  public get width(): number {
    return this._sprite.width;
  }

  public set width(value: number) {
    this._sprite.width = value;
  }

  /**
   * Replaces the sprite's texture. The previous texture is **not**
   * destroyed — texture lifetime is the caller's responsibility.
   *
   * @param texture The new texture to render.
   */
  public setTexture(texture: Texture): void {
    this._sprite.texture = texture;
  }

  public onAdded(): void {
    this._scene.addChild(this._sprite);
  }

  public onUpdate(): void {
    // Empty by design — transform sync runs in onPostUpdate so the visual
    // reflects every behavior change made this tick, regardless of which
    // component made it.
  }

  public onPostUpdate(): void {
    this._sprite.x = this.host.position.x;
    this._sprite.y = this.host.position.y;
    this._sprite.rotation = this.host.rotation;
    this._sprite.scale.set(this.host.scale.x, this.host.scale.y);
  }

  public onDestroy(): void {
    this._scene.removeChild(this._sprite);
    this._sprite.destroy();
  }
}
```

## The `raw` accessor — copy the warning verbatim

Every wrapping component exposes a `raw` accessor with a JSDoc block that
follows the same template, adapted only for the library name. The warning is
the public contract of the escape hatch — keep it consistent across
components so users learn the rule once and recognize it everywhere.

The template:

```typescript
/**
 * Direct access to the underlying <LIBRARY> <TYPE> instance.
 *
 * **Use with care.** `raw` is an intentional escape hatch for cases the
 * arcade2d API doesn't cover — <SPECIFIC EXAMPLES FOR THIS COMPONENT>.
 * Code that touches `raw` is coupled to <LIBRARY>'s public API and may
 * break when:
 *
 * - arcade2d upgrades <LIBRARY> (including minor versions).
 * - <LIBRARY> itself ships a breaking change.
 * - arcade2d swaps <LIBRARY> for a different <ROLE>.
 *
 * None of those will be treated as breaking changes to arcade2d's own
 * surface. Prefer the typed methods on this component; reach for `raw`
 * only when no equivalent exists, and isolate the access behind your own
 * helper so the coupling is in one place.
 */
public get raw(): <LibraryType> {
  return this._<internal>;
}
```

The specific-examples sentence matters — it tells the user what `raw` was
designed to enable, which both validates legitimate uses and steers them
toward the surface for everything else.

## Proxy methods — consistency rules

Across the engine, wrapping components should feel like one library, not a
patchwork of upstream APIs. Apply these rules to every proxy method or
property you add:

- **Use arcade2d types at the boundary.** Accept and return `Point`,
  `Rectangle`, `Circle`, `Polygon` from `geometry/`, not the library's own
  vector/rect types. Convert internally. This is the single biggest reason
  composition pays off; do not skip it.
- **Match arcade2d naming.** `width`/`height` not `w`/`h`; `position` not
  `pos`; `rotation` in radians (engine convention); method names that mirror
  sibling components (e.g. all wrapping components that hold a resource use
  `setX` rather than mixing `setX`/`updateX`/`replaceX`).
- **Mirror arcade2d mutability rules.** Components expose state with `get`
  and `set` accessors; favor `readonly` on internal fields unless mutation
  is genuinely required.
- **Don't reflect every upstream method.** A proxy isn't a transparent
  forwarder — surface what an arcade2d user actually needs. The escape hatch
  exists for the long tail.
- **Route errors through `throwEngineError`** with a code from `ErrorCode`.
  If you catch an exception from the wrapped library and rethrow, do it as
  an `EngineError` with context.

## Lifecycle responsibilities

Wrapping components are the bridge between the engine's lifecycle and the
external library's lifecycle. Get these right:

- **`onAdded(deps)`** — attach the external instance to whatever container
  it lives in (scene graph, physics world, audio context). If the component
  needs siblings (e.g. a graphics component needs the `Scene`), resolve them
  via `resolveDependencies` rather than ad-hoc `getComponentByType` calls in
  the constructor — see `WorldObjectComponent` and the existing dependency
  resolver for the typed pattern.
- **`onPreUpdate(update, deps)`** — optional; use for sampling/preparing
  state other components will read this tick (rare for graphics, common for
  input or physics broadphase).
- **`onUpdate(update, deps)`** — main per-frame work. For pure
  transform-sync components like a sprite this is often empty; for physics
  bodies this is where integration happens.
- **`onPostUpdate(update, deps)`** — copy the host transform into the
  external instance here, not in `onUpdate`. This way the visual reflects
  every behavior change made earlier in the tick regardless of which
  component made it or what phase it ran in.
- **`onDestroy(deps)`** — detach from its container *and* release any
  library-owned resources the component allocated (textures, geometries,
  audio buffers). The component owns what it created.

Per-component error isolation is the engine's job (`World.update` and
`WorldObject._runComponentPhase` wrap callbacks in try/catch and route
failures through `World.reportError`). You don't need to defend against
your own throws — but you do need to make sure your `onDestroy` is safe to
call after a partial construction failure, since `removeAllComponents` may
invoke it on a component whose `onAdded` never ran.

## Tests

Colocate `foo.spec.ts` next to `foo.ts`. Cover, at minimum:

- **Construction** — the component holds a reference to the underlying
  instance and exposes it via `raw`.
- **Proxy methods** — each proxy method/property reads and writes through to
  the underlying instance. Where conversions happen (arcade2d type ↔ library
  type), assert the conversion is correct in both directions.
- **Lifecycle attach/detach** — `onAdded` attaches to the container,
  `onDestroy` detaches and releases resources. A common pattern is to spy on
  the container's `addChild`/`removeChild` (or equivalent) and assert
  call order.
- **Transform sync** — after mutating the host transform and calling
  `onPostUpdate`, the underlying instance reflects the new transform.
- **Thrown `ErrorCode`s** — any documented `@throws` is exercised and the
  specific code asserted.

If the library has no usable mock (e.g. Pixi WebGL bits), inject a thin test
double through the constructor or use a fake `Scene` component on a fresh
`World`. Do not pull in `jsdom` or a real GPU context just for tests.

## Migrating an existing inheritance-based component

`SimpleGraphics` (`packages/engine/src/graphics/graphics.ts`) and `Scene`
(`packages/engine/src/graphics/scene.ts`) currently use inheritance. If you
are migrating one:

1. Replace `extends X` with a private `_x: X` field initialized in the
   constructor.
2. Add the `raw` getter with the standard warning.
3. Walk every external call site (consumers, demos, tests) and audit which
   members they touch on the component — those are the methods you must
   proxy. Don't proxy the rest.
4. Update lifecycle hooks to operate on `this._x` instead of `this`.
5. Update tests to use the proxy surface; assert against `raw` only where
   testing the escape hatch itself.
6. Re-run `yarn typecheck`, `yarn test`, and the relevant demo
   (`yarn demo:td-shooter`) end to end.

## After you finish

Run the standard verification (from `CLAUDE.md`):

- `npx tsc --noEmit` (or `yarn typecheck`)
- `yarn jest` (or `yarn test`)
- For graphics/audio/physics work, verify the relevant demo still runs and
  looks correct — typecheck and unit tests don't catch a sprite that
  silently renders at the wrong scale.
- Confirm the new symbol is re-exported from the relevant barrel file.
