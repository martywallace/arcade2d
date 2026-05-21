/**
 * Converts a PascalCase / camelCase symbol name into a kebab-case URL slug,
 * matching the engine's own file-naming convention (`WorldObject` ->
 * `world-object`). Slugs are the stable identity of a doc page, so the same
 * function is used both when emitting a page's path and when resolving a
 * cross-link to it.
 */
export function toSlug(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

/** Anchor id for a member within its owning symbol page. */
export function memberAnchor(memberName: string): string {
  return toSlug(memberName);
}
