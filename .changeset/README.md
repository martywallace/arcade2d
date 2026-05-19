# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

Only `@arcade2d/engine` is published to npm. To record a change that should
trigger a release, run:

```
yarn changeset
```

and follow the prompts. CI runs `changeset version` + `changeset publish` on
merge to `main` (see `.github/workflows/release.yml`). The demos and dev server
are ignored by changesets and are never published to npm.
