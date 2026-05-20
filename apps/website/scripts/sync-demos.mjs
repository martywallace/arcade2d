#!/usr/bin/env node
/**
 * Copy each demo's built `dist/` into `apps/website/public/embeds/<dir>/` so
 * Astro serves it as a static asset at `/embeds/<dir>/index.html`.
 *
 * Runs before `astro dev` and `astro build`. The website declares each demo
 * as a workspace dependency, so by the time Turbo invokes this script in a
 * `turbo run build` graph, the demo `dist/` directories already exist.
 *
 * This script doesn't know or care which demos the website actually lists —
 * it just mirrors every `demos/<dir>/dist` it can find. The website's
 * `src/demos.ts` registry is what controls which slugs are routable and how
 * they're presented; a demo whose `dist/` exists but isn't in the registry
 * is harmlessly served but unlinked.
 */
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(here, '..');
const monorepoRoot = resolve(websiteRoot, '..', '..');
const demosRoot = resolve(monorepoRoot, 'demos');
const embedsDir = resolve(websiteRoot, 'public', 'embeds');

await rm(embedsDir, { recursive: true, force: true });
await mkdir(embedsDir, { recursive: true });

const dirEntries = await readdir(demosRoot, { withFileTypes: true });
let synced = 0;
let missing = 0;

for (const entry of dirEntries) {
  if (!entry.isDirectory()) continue;
  const demoDir = entry.name;
  const src = resolve(demosRoot, demoDir, 'dist');
  const dest = resolve(embedsDir, demoDir);

  if (!(await isDir(src))) {
    console.warn(`[sync-demos] skip ${demoDir} (no dist/)`);
    missing++;
    continue;
  }

  await cp(src, dest, { recursive: true });
  console.log(`[sync-demos] ${demoDir} -> public/embeds/${demoDir}/`);
  synced++;
}

console.log(`[sync-demos] done (${synced} synced, ${missing} skipped)`);

async function isDir(p) {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}
