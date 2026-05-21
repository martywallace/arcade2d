import { renderType } from './types';
import type { Parameter, Reflection, Signature } from './load';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const punct = (s: string) => `<span class="ty-punct">${esc(s)}</span>`;
const name = (s: string) => `<span class="sig-name">${esc(s)}</span>`;

function paramList(params: Parameter[] | undefined): string {
  return (params ?? [])
    .map((p) => {
      const rest = p.flags?.isRest ? punct('...') : '';
      const opt = p.flags?.isOptional ? punct('?') : '';
      return `${rest}<span class="sig-param">${esc(p.name)}</span>${opt}${punct(': ')}${renderType(p.type)}`;
    })
    .join(punct(', '));
}

function typeParams(tp: Reflection[] | undefined): string {
  if (!tp || tp.length === 0) return '';
  return punct('<') + tp.map((t) => esc(t.name)).join(punct(', ')) + punct('>');
}

/** `methodName<T>(a: Foo, b?: Bar): Baz` for one call/constructor signature. */
export function signatureLine(memberName: string, sig: Signature): string {
  return (
    name(memberName) +
    typeParams(sig.typeParameter) +
    punct('(') +
    paramList(sig.parameters) +
    punct(')') +
    punct(': ') +
    renderType(sig.type)
  );
}

/** `propName: Foo` for a property reflection. */
export function propertyLine(member: Reflection): string {
  const opt = member.flags?.isOptional ? punct('?') : '';
  return name(member.name) + opt + punct(': ') + renderType(member.type);
}

/** `accessorName: Foo` derived from the get (or set) signature. */
export function accessorLine(member: Reflection): string {
  const sig = member.getSignature ?? member.setSignature;
  const type = member.getSignature?.type ?? member.setSignature?.parameters?.[0]?.type;
  void sig;
  return name(member.name) + punct(': ') + renderType(type);
}

/** Modifier keywords (`static`, `readonly`, `abstract`, `protected`). */
export function modifiers(member: Reflection): string[] {
  const f = member.flags ?? {};
  const out: string[] = [];
  if (f.isStatic) out.push('static');
  if (f.isAbstract) out.push('abstract');
  if (f.isProtected) out.push('protected');
  if (f.isReadonly) out.push('readonly');
  if (member.getSignature && !member.setSignature) out.push('readonly');
  return out;
}
