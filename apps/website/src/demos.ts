/**
 * Registry of demos that the website embeds.
 *
 * Each entry describes one demo workspace under `demos/<workspaceDir>` in the
 * monorepo. The `sync-demos.mjs` build step reads this list to copy each
 * demo's `dist/` into `public/embeds/<slug>/`, and the dynamic
 * `/demos/[slug]` route reads it to render the page metadata + iframe.
 *
 * To add a demo:
 *   1. Make sure the demo package builds with `base: './'` so its asset URLs
 *      are relative (required to serve it from `/embeds/<slug>/`).
 *   2. Add the demo as a workspace dependency in `apps/website/package.json`
 *      so Turbo builds it before the website.
 *   3. Append a new entry here.
 */
/**
 * A single control binding shown in a demo's instructions panel — a chunk of
 * input (`WASD`, `Mouse`, `Click`) paired with what it does in the demo.
 */
export type DemoControl = {
  /** The input, e.g. `WASD`, `Mouse`, `Click`. Rendered as a key cap. */
  readonly input: string;
  /** What the input does, e.g. `Move`, `Aim`, `Shoot`. */
  readonly action: string;
};

export type DemoEntry = {
  /** URL slug — the demo will be reachable at `/demos/<slug>`. */
  readonly slug: string;
  /** Human-readable title shown in listings and on the demo page. */
  readonly title: string;
  /** One-line description used on the demos index. */
  readonly description: string;
  /** Folder name under `demos/` in the monorepo root. */
  readonly workspaceDir: string;
  /**
   * Input bindings for the demo, rendered as an instructions panel beneath the
   * embed. Omit for demos that take no input.
   */
  readonly controls?: readonly DemoControl[];
};

export const DEMOS: readonly DemoEntry[] = [
  {
    slug: 'td-shooter',
    title: 'Top-Down Shooter',
    description:
      'A top-down shooter built on arcade2d — player movement, prefab spawning, and a pile of zombies. The de-facto end-to-end exercise of the engine.',
    workspaceDir: 'td-shooter',
    controls: [
      { input: 'WASD', action: 'Move' },
      { input: 'Mouse', action: 'Aim' },
      { input: 'Click', action: 'Shoot' },
    ],
  },
];

export function findDemo(slug: string): DemoEntry | undefined {
  return DEMOS.find((d) => d.slug === slug);
}
