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
const THEME = 'github-light';

// Created once at module load. `createHighlighter` is async (it loads grammars
// + theme), but the resulting `codeToHtml` is synchronous — which lets the
// Markdown renderer stay sync. Top-level await is fine in the SSG build.
const highlighter = await createHighlighter({
  themes: [THEME],
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
  return highlighter.codeToHtml(code, { lang: safeLang, theme: THEME });
}
