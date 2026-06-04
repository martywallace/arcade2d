# arcade2d

**A 2D game engine for TypeScript.** arcade2d gives you a component-driven
world model, prefab-based object spawning, and a batteries-included runtime for
rendering, physics, audio, and input — built on the libraries you already
reach for, with a fully-typed, thoroughly-documented API.

- **Website:** https://arcade2d.com
- **Demos:** https://arcade2d.com/demos
- **API reference:** https://arcade2d.com/docs

```bash
npm install @arcade2d/engine
```

## What it is

arcade2d is the engine at the center of a longer-term engine + editor +
dev-server vision. The engine itself is the part you install today: a small,
strongly-typed core that organizes a game as a **`World` of `WorldObject`s**,
each assembled from **composable components**, ticked through a single
deterministic update loop.

The design goals:

- **Composition over inheritance.** Behaviour is built by attaching components
  to world objects, not by deepening a class hierarchy. Components declare
  their dependencies and own their lifecycle, so systems stay decoupled.
- **Prefabs as the unit of content.** Objects are described once as a prefab
  and spawned through the world, so "what a thing is" is separated from "when
  it exists."
- **Wrap, don't reinvent.** The engine leans on best-in-class libraries for the
  hard parts and presents them through one coherent, pixel-native API rather
  than shipping a weaker home-grown version of each.
- **The docs are the product.** Every public symbol carries thorough JSDoc and
  cross-links, surfaced in your editor and rendered to the
  [API reference](https://arcade2d.com/docs). The engine is built to be learned
  from autocomplete.
- **Strict by default.** The codebase runs under TypeScript's strictest
  settings and codifies every engine error behind an `ErrorCode`, so failure
  modes are part of the typed contract.

## Built on

| Concern   | Building block                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Rendering | [PixiJS](https://pixijs.com) v8 — the scene graph, shapes, sprites, textures, and frame animation          |
| Physics   | [Rapier](https://rapier.rs) (`rapier2d-compat`) — rigid bodies, colliders, and gravity, wired pixel-native |
| Audio     | The Web Audio API — sound effects and music over master and per-category volume buses                      |
| Input     | Keyboard and mouse state, sampled per tick                                                                 |

arcade2d's job is to bind these together behind the world/object/component
model so you write game logic, not glue code.

## Demos

Three demos exercise the engine end-to-end and double as living documentation
of idiomatic arcade2d code. Play them in the browser, or read the source:

- **[Simple Shooter](https://arcade2d.com/demos/simple-shooter)** — top-down
  shooter with player movement, prefab spawning, and a pile of zombies,
  rendered with basic shapes.
- **[Dungeon Crawler](https://arcade2d.com/demos/dungeon-crawler)** — texture
  and sprite rendering with a full tileset and animated characters.
- **[Physics Playground](https://arcade2d.com/demos/physics-playground)** — a
  Rapier-backed rigid-body sandbox of falling, colliding, stacking shapes.

## Development

This repository is a Yarn 4 workspaces monorepo orchestrated by Turborepo.
The published engine lives in `packages/engine`; everything else is tooling,
demos, and the marketing/docs site.

```
packages/
  engine/           @arcade2d/engine — the published package (ESM + CJS + d.ts)
  tsconfig/         shared TypeScript base configs (private)
  eslint-config/    shared flat ESLint configs (private)
demos/
  simple-shooter/   shapes-based shooter (private)
  dungeon-crawler/  texture & sprite rendering (private)
  physics-playground/ Rapier rigid-body sandbox (private)
apps/
  website/          arcade2d.com — marketing site + generated API reference
  devserver/        in-progress dev-server / editor surface
docker/
  devserver.Dockerfile   builds backend + frontend into a single image
```

**Requirements:** Node 22+. Yarn is pinned via Corepack — run `corepack enable`
once.

```bash
yarn install                 # install everything
yarn build                   # turbo build (engine -> consumers)
yarn typecheck               # turbo typecheck across all workspaces
yarn lint                    # turbo lint
yarn test                    # turbo test (Jest)
yarn demo:simple-shooter     # run a demo against freshly-built engine dist
yarn demo:dungeon-crawler
yarn demo:physics-playground
yarn website                 # run the arcade2d.com site locally
yarn devserver               # run the dev-server backend + frontend
```

## Publishing

Only `@arcade2d/engine` is published to npm. Record changes with
`yarn changeset`, bump with `yarn version-packages`, then tag and publish a
GitHub Release — the `Release` workflow publishes to npm on `release:
published`. The website deploys to Cloudflare from `apps/website`, and the dev
server image is built and pushed to GHCR by the `Dev Server Image` workflow.

## License

[MIT](packages/engine/package.json) © Marty Wallace
