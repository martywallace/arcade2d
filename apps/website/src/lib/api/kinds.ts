/**
 * TypeDoc `ReflectionKind` values, narrowed to the kinds the engine's public
 * surface actually produces. TypeDoc encodes kind as a bit flag; we only ever
 * compare equality, so plain numeric constants are enough.
 *
 * @see https://typedoc.org/api/enums/Models.ReflectionKind.html
 */
export const Kind = {
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  Accessor: 262144,
  TypeAlias: 2097152,
  TypeLiteral: 65536,
} as const;

export type KindValue = (typeof Kind)[keyof typeof Kind];

/** Human-readable singular label for a top-level reflection kind. */
export function kindLabel(kind: number): string {
  switch (kind) {
    case Kind.Class:
      return 'Class';
    case Kind.Interface:
      return 'Interface';
    case Kind.Enum:
      return 'Enum';
    case Kind.TypeAlias:
      return 'Type Alias';
    case Kind.Function:
      return 'Function';
    case Kind.Variable:
      return 'Variable';
    default:
      return 'Symbol';
  }
}

/** Short lowercase token used for the kind chip on cards and headers. */
export function kindTag(kind: number): string {
  return kindLabel(kind).toLowerCase().replace(/\s+/g, '-');
}

/**
 * Sort weight for ordering symbols within a category — the "headline" kinds
 * (classes, enums) come first, then interfaces, then the supporting type
 * aliases, functions, and variables.
 */
export function kindRank(kind: number): number {
  switch (kind) {
    case Kind.Class:
    case Kind.Enum:
      return 0;
    case Kind.Interface:
      return 1;
    case Kind.TypeAlias:
      return 2;
    default:
      return 3;
  }
}
