import { marked } from 'marked';
import { highlightCode } from './highlight';
import { hrefForId, type BlockTag, type Comment, type CommentPart } from './load';

marked.setOptions({ gfm: true });

// Replace fenced code-block rendering with Shiki-highlighted output. marked's
// renderer.code is synchronous; Shiki's codeToHtml is too (the async cost was
// paid once when the highlighter loaded), so this composes cleanly.
marked.use({
  renderer: {
    code({ text, lang }) {
      return highlightCode(text, lang);
    },
  },
});

/**
 * Flattens TypeDoc comment parts into a Markdown string, resolving `{@link}`
 * inline tags to in-site anchors where possible. `text` and `code` parts are
 * already Markdown (inline code and fenced `@example` blocks arrive verbatim),
 * so they pass straight through; only link tags need rewriting.
 */
function partsToMarkdown(parts: CommentPart[] | undefined): string {
  if (!parts) return '';
  let out = '';
  for (const part of parts) {
    if (part.kind === 'inline-tag' && part.tag === '@link') {
      const label = part.text.trim();
      const href = typeof part.target === 'number' ? hrefForId(part.target) : null;
      out += href ? `[${label}](${href})` : `\`${label}\``;
    } else {
      // text + code parts are literal Markdown already.
      out += part.text;
    }
  }
  return out;
}

/** Renders comment parts to an HTML fragment (Markdown + resolved links). */
export function renderParts(parts: CommentPart[] | undefined): string {
  const md = partsToMarkdown(parts);
  return md ? (marked.parse(md, { async: false }) as string) : '';
}

/** Renders a comment's summary (the lead prose) to HTML. */
export function renderSummary(comment: Comment | undefined): string {
  return renderParts(comment?.summary);
}

/** Returns true if the comment has any summary prose. */
export function hasSummary(comment: Comment | undefined): boolean {
  return Boolean(comment?.summary && comment.summary.length > 0);
}

/** All block tags of a given `@name`, in source order. */
export function blockTags(comment: Comment | undefined, tag: string): BlockTag[] {
  return (comment?.blockTags ?? []).filter((t) => t.tag === tag);
}

export function firstBlockTag(comment: Comment | undefined, tag: string): BlockTag | undefined {
  return blockTags(comment, tag)[0];
}

/** Render a single block tag's content (e.g. one `@throws`, `@returns`). */
export function renderBlockTag(tag: BlockTag | undefined): string {
  return tag ? renderParts(tag.content) : '';
}

/**
 * Extracts a short plain-text excerpt (the first paragraph) from a comment's
 * summary — used on listing cards, where rendering the full Markdown docblock
 * (headings, diagrams, code fences) would blow out the layout. Stops at the
 * first blank line and strips inline-code backticks.
 */
export function summaryExcerpt(comment: Comment | undefined, maxLen = 180): string {
  const parts = comment?.summary;
  if (!parts) return '';

  let text = '';
  for (const part of parts) {
    const chunk = part.kind === 'code' ? part.text.replace(/`+/g, '') : part.text;
    const breakAt = chunk.indexOf('\n\n');
    if (breakAt !== -1) {
      text += chunk.slice(0, breakAt);
      break;
    }
    text += chunk;
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxLen) {
    text = text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
  }
  return text;
}
