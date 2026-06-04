import { createHighlighter } from 'shiki';

/**
 * Languages that appear in the engine's JSDoc `@example` fences. Anything
 * outside this set falls back to plaintext (still escaped + styled, just not
 * tokenized) so an unexpected fence never breaks the build.
 */
const LANGS = ['typescript', 'tsx', 'javascript', 'json', 'bash'] as const;
const ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
};

// Dual-theme output: `light` colors are applied inline as the default, while
// `dark` colors ride along on a per-token `--shiki-dark` custom property. The
// stylesheet swaps to that property under html[data-theme='dark'] (global.css),
// so a single static render serves both themes with no client-side rehighlight.
const THEMES = { light: 'github-light', dark: 'github-dark' } as const;

// Created once at module load. `createHighlighter` is async (it loads grammars
// + themes), but the resulting `codeToHtml` is synchronous — which lets the
// Markdown renderer stay sync. Top-level await is fine in the SSG build.
const highlighter = await createHighlighter({
  themes: [THEMES.light, THEMES.dark],
  langs: [...LANGS],
});

const loaded = new Set<string>(highlighter.getLoadedLanguages());

/**
 * Highlights a code block to HTML. The `lang` comes from the Markdown fence
 * info string (e.g. ```` ```typescript ````); unknown or empty langs render as
 * plaintext.
 */
export function highlightCode(code: string, lang: string | undefined): string {
  const resolved = lang ? (ALIASES[lang] ?? lang) : 'text';
  const safeLang = loaded.has(resolved) ? resolved : 'text';
  return highlighter.codeToHtml(code, {
    lang: safeLang,
    themes: THEMES,
    defaultColor: 'light',
  });
}
