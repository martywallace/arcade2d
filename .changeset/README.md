# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

Only `@arcade2d/engine` is published to npm. Record a change that should
trigger a release with:

```
yarn changeset
```

and follow the prompts. To cut a release:

```
yarn version-packages   # applies changesets: bumps version + changelog
git commit -am "chore: release"
git tag vX.Y.Z && git push --follow-tags
```

then publish a GitHub Release for that tag. The `Release` workflow
(`.github/workflows/release.yml`) runs `changeset publish` on the
`release: published` event. The demos and dev server are ignored by changesets
and are never published to npm.
