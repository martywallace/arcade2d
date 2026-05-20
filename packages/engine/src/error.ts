export enum ErrorCode {
  COMPONENT_NOT_FOUND = 'COMP001_COMPONENT_NOT_FOUND',
  COMPONENT_ALREADY_EXISTS = 'COMP002_COMPONENT_ALREADY_EXISTS',
  COMPONENT_AMBIGUOUS_TYPE = 'COMP003_COMPONENT_AMBIGUOUS_TYPE',
  PREFAB_INVALID_NAME = 'PREFAB001_PREFAB_INVALID_NAME',
  PREFAB_ALREADY_REGISTERED = 'PREFAB002_PREFAB_ALREADY_REGISTERED',
  PREFAB_NOT_FOUND = 'PREFAB003_PREFAB_NOT_FOUND',
  PREFAB_REGISTRY_NOT_ATTACHED = 'PREFAB004_PREFAB_REGISTRY_NOT_ATTACHED',
  PREFAB_BUILD_UNAUTHORIZED = 'PREFAB005_PREFAB_BUILD_UNAUTHORIZED',
  WORLD_COMPONENT_DEPENDENCY_MISSING = 'DEP001_WORLD_COMPONENT_DEPENDENCY_MISSING',
  WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS = 'DEP002_WORLD_COMPONENT_DEPENDENCY_AMBIGUOUS',
  WORLD_COMPONENT_DEPENDENCY_REENTRANT = 'DEP003_WORLD_COMPONENT_DEPENDENCY_REENTRANT',
  GAME_WORLD_ALREADY_EXISTS = 'GAME001_GAME_WORLD_ALREADY_EXISTS',
  GAME_WORLD_NOT_FOUND = 'GAME002_GAME_WORLD_NOT_FOUND',
  RANDOM_EMPTY_ITEMS = 'RAND001_RANDOM_EMPTY_ITEMS',
}

export class EngineError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message = 'There was an internal engine error %s, see stack trace for additional details.',
    public readonly context?: Record<string, unknown>,
  ) {
    super(message.replace('%s', code));

    Object.setPrototypeOf(this, EngineError.prototype);
    this.name = this.constructor.name;
  }
}

export function throwEngineError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>,
): never {
  throw new EngineError(code, message, context);
}
