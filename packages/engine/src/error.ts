export enum ErrorCode {
  COMPONENT_NOT_FOUND = 'COMP001_COMPONENT_NOT_FOUND',
  COMPONENT_ALREADY_EXISTS = 'COMP002_COMPONENT_ALREADY_EXISTS',
  COMPONENT_AMBIGUOUS_TYPE = 'COMP003_COMPONENT_AMBIGUOUS_TYPE',
  PREFAB_INVALID_NAME = 'PREFAB001_PREFAB_INVALID_NAME',
  PREFAB_ALREADY_REGISTERED = 'PREFAB002_PREFAB_ALREADY_REGISTERED',
  PREFAB_NOT_FOUND = 'PREFAB003_PREFAB_NOT_FOUND',
  PREFAB_REGISTRY_NOT_ATTACHED = 'PREFAB004_PREFAB_REGISTRY_NOT_ATTACHED',
  PREFAB_BUILD_UNAUTHORIZED = 'PREFAB005_PREFAB_BUILD_UNAUTHORIZED',
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
