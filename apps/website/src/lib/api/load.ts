import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Kind } from './kinds';
import { memberAnchor, toSlug } from './slug';

/**
 * A single comment fragment as emitted by TypeDoc — plain prose, a span of
 * inline code, or an `{@link}` inline tag pointing at another reflection.
 */
export type CommentPart = {
  kind: 'text' | 'code' | 'inline-tag';
  text: string;
  tag?: string;
  target?: number | string | { qualifiedName?: string };
};

export type BlockTag = {
  tag: string;
  name?: string;
  content: CommentPart[];
};

export type Comment = {
  summary?: CommentPart[];
  blockTags?: BlockTag[];
};

/** Loose view of a TypeDoc serialized type. Only the fields we render. */
export type TypeNode = {
  type: string;
  name?: string;
  target?: number | string | { qualifiedName?: string };
  value?: unknown;
  types?: TypeNode[];
  elementType?: TypeNode;
  typeArguments?: TypeNode[];
  declaration?: Reflection;
  operator?: string;
  objectType?: TypeNode;
  indexType?: TypeNode;
  elements?: TypeNode[];
  queryType?: TypeNode;
  [key: string]: unknown;
};

export type Parameter = {
  id: number;
  name: string;
  comment?: Comment;
  type?: TypeNode;
  flags?: { isOptional?: boolean; isRest?: boolean };
  defaultValue?: string;
};

export type Signature = {
  id: number;
  name: string;
  comment?: Comment;
  parameters?: Parameter[];
  type?: TypeNode;
  typeParameter?: Reflection[];
};

export type Reflection = {
  id: number;
  name: string;
  kind: number;
  variant?: string;
  flags?: {
    isOptional?: boolean;
    isReadonly?: boolean;
    isStatic?: boolean;
    isAbstract?: boolean;
    isProtected?: boolean;
  };
  comment?: Comment;
  children?: Reflection[];
  groups?: { title: string; children: number[] }[];
  signatures?: Signature[];
  getSignature?: Signature;
  setSignature?: Signature;
  type?: TypeNode;
  parameters?: Parameter[];
  typeParameter?: Reflection[];
  extendedTypes?: TypeNode[];
  implementedTypes?: TypeNode[];
  sources?: { fileName: string; line: number; url?: string }[];
  defaultValue?: string;
};

export type Project = Reflection & {
  packageName?: string;
  children: Reflection[];
  groups?: { title: string; children: number[] }[];
};

/** A top-level documented symbol, paired with its resolved page slug. */
export type DocSymbol = {
  slug: string;
  reflection: Reflection;
};

/** Where a given reflection id lives in the rendered docs. */
export type Link = {
  slug: string;
  anchor?: string;
};

const project = loadProject();
const byId = new Map<number, Reflection>();
const linkIndex = new Map<number, Link>();
const symbolsBySlug = new Map<string, DocSymbol>();

indexProject();

function loadProject(): Project {
  // astro build runs with the website package as cwd, so the generated JSON
  // sits at a fixed path relative to it. Read at module load — pages import
  // this module and the data is shared across the whole static build.
  const jsonPath = resolve(process.cwd(), '.typedoc/api.json');
  return JSON.parse(readFileSync(jsonPath, 'utf8')) as Project;
}

function indexProject(): void {
  for (const child of project.children ?? []) {
    const slug = toSlug(child.name);
    symbolsBySlug.set(slug, { slug, reflection: child });
    // The symbol's own id links to its page root (no anchor).
    register(child, slug, undefined);
  }
}

// Walk a reflection subtree, recording every id -> {slug, anchor}. Direct
// members (one level under a top-level symbol) own an anchor; everything
// deeper (signatures, parameters) inherits the nearest member's anchor.
function register(node: Reflection, slug: string, anchor: string | undefined): void {
  byId.set(node.id, node);
  linkIndex.set(node.id, { slug, anchor });
  for (const child of node.children ?? []) {
    const childAnchor = anchor ?? memberAnchor(child.name);
    register(child, slug, childAnchor);
  }
  for (const sig of node.signatures ?? []) {
    byId.set(sig.id, node);
    linkIndex.set(sig.id, { slug, anchor });
  }
}

/** All documented top-level symbols, in TypeDoc's declared order. */
export function allSymbols(): DocSymbol[] {
  return [...symbolsBySlug.values()];
}

/** Top-level symbols grouped by kind, in the project's group order. */
export function symbolGroups(): { title: string; symbols: DocSymbol[] }[] {
  const groups = project.groups ?? [];
  return groups
    .map((g) => ({
      title: g.title,
      symbols: g.children
        .map((id) => byId.get(id))
        .filter((r): r is Reflection => Boolean(r))
        .map((r) => symbolsBySlug.get(toSlug(r.name)))
        .filter((s): s is DocSymbol => Boolean(s)),
    }))
    .filter((g) => g.symbols.length > 0);
}

export function getSymbol(slug: string): DocSymbol | undefined {
  return symbolsBySlug.get(slug);
}

export function getReflection(id: number): Reflection | undefined {
  return byId.get(id);
}

/**
 * Resolves a reflection id (from an `{@link}` target or a type reference) to
 * an in-site href, or `null` when the target isn't part of the documented
 * surface (e.g. a PIXI or lib.dom type).
 */
export function hrefForId(id: number): string | null {
  const link = linkIndex.get(id);
  if (!link) return null;
  return link.anchor ? `/docs/${link.slug}#${link.anchor}` : `/docs/${link.slug}`;
}

export { Kind };
