# Arcade2D

A monorepo for 2D game development tooling in TypeScript: a publishable game
engine, example games, and a self-contained dev server.

## Layout

```
packages/
  engine/           @arcade2d/engine — published to npm (tsup, ESM + CJS + d.ts)
  tsconfig/         shared TypeScript base configs (private)
  eslint-config/    shared flat ESLint configs (private)
demos/
  td-shooter/       example game consuming @arcade2d/engine (private)
apps/
  devserver/
    backend/        NestJS API/host (private)
    frontend/       React + Vite editor UI (private)
docker/
  devserver.Dockerfile   builds backend + frontend into a single image
```

## Requirements

Node 22+. Yarn is pinned via Corepack (`packageManager` in the root
`package.json`) — run `corepack enable` once.

## Common tasks

```
yarn install            # install everything
yarn build              # turbo build (engine -> consumers)
yarn typecheck           # turbo typecheck
yarn lint               # turbo lint
yarn test               # turbo test
yarn demo:td-shooter    # run the demo game (requires engine built once)
yarn devserver          # run backend + frontend with hot reload
```

## Dev server

The React frontend builds to static assets that the NestJS backend serves, so
the whole thing runs as **one process on one port**. In development the two run
separately and Vite proxies `/api` to Nest.

Run from a published image (single container):

```
docker run -p 4000:4000 ghcr.io/<owner>/arcade2d-devserver:latest
```

Build the image locally (from the repo root):

```
docker build -f docker/devserver.Dockerfile -t arcade2d-devserver .
```

## Publishing

Only `@arcade2d/engine` is published to npm. Record changes with
`yarn changeset`, bump with `yarn version-packages`, then tag and publish a
GitHub Release — the `Release` workflow publishes to npm on `release:
published`. The dev server image is built and pushed to GHCR by the
`Dev Server Image` workflow.
