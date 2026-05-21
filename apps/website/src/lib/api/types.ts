import { hrefForId, type Reflection, type Signature, type TypeNode } from './load';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const kw = (s: string) => `<span class="ty-kw">${esc(s)}</span>`;
const punct = (s: string) => `<span class="ty-punct">${esc(s)}</span>`;
const ident = (s: string) => `<span class="ty-name">${esc(s)}</span>`;

/**
 * Renders a TypeDoc serialized type to an HTML fragment, linking any
 * reference whose target is part of the documented surface. Unknown or
 * external references degrade to plain (unlinked) identifiers, and any type
 * variant we don't explicitly handle falls back to its `name` so the output
 * is always _something_ reasonable rather than throwing.
 */
export function renderType(type: TypeNode | undefined): string {
  if (!type) return ident('unknown');

  switch (type.type) {
    case 'intrinsic':
      return `<span class="ty-intrinsic">${esc(type.name ?? 'any')}</span>`;

    case 'literal':
      return `<span class="ty-literal">${esc(formatLiteral(type.value))}</span>`;

    case 'reference':
      return renderReference(type);

    case 'array':
      return renderType(type.elementType) + punct('[]');

    case 'union':
      return (type.types ?? []).map(renderType).join(punct(' | '));

    case 'intersection':
      return (type.types ?? []).map(renderType).join(punct(' & '));

    case 'tuple':
      return (
        punct('[') +
        (type.elements ?? []).map(renderType).join(punct(', ')) +
        punct(']')
      );

    case 'reflection':
      return renderReflectionType(type.declaration);

    case 'typeOperator':
      return kw(`${type.operator} `) + renderType(type.target as TypeNode);

    case 'indexedAccess':
      return (
        renderType(type.objectType) +
        punct('[') +
        renderType(type.indexType) +
        punct(']')
      );

    case 'query':
      return kw('typeof ') + renderType(type.queryType);

    default:
      return ident(type.name ?? type.type);
  }
}

function renderReference(type: TypeNode): string {
  const name = type.name ?? 'unknown';
  let head = ident(name);

  if (typeof type.target === 'number') {
    const href = hrefForId(type.target);
    if (href) head = `<a class="ty-link" href="${href}">${esc(name)}</a>`;
  }

  const args = type.typeArguments;
  if (args && args.length > 0) {
    // Pass raw angle brackets — punct() escapes them once via esc().
    head += punct('<') + args.map(renderType).join(punct(', ')) + punct('>');
  }
  return head;
}

function renderReflectionType(decl: Reflection | undefined): string {
  if (!decl) return ident('object');

  // Function type: `(a: T, b: U) => R`
  const sig = decl.signatures?.[0];
  if (sig) return renderFunctionType(sig);

  // Object literal type: render the member shape compactly.
  const members = decl.children ?? [];
  if (members.length === 0) return punct('{}');
  const inner = members
    .map((m) => {
      const opt = m.flags?.isOptional ? punct('?') : '';
      return `${ident(m.name)}${opt}${punct(': ')}${renderType(m.type)}`;
    })
    .join(punct('; '));
  return punct('{ ') + inner + punct(' }');
}

function renderFunctionType(sig: Signature): string {
  const params = (sig.parameters ?? [])
    .map((p) => `${ident(p.name)}${punct(': ')}${renderType(p.type)}`)
    .join(punct(', '));
  return punct('(') + params + punct(') => ') + renderType(sig.type);
}

function formatLiteral(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`;
  if (value === null) return 'null';
  return String(value);
}
