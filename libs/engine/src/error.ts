export enum ErrorCode {
  COMPONENT_NOT_FOUND = 'COMP001_COMPONENT_NOT_FOUND',
  COMPONENT_ALREADY_EXISTS = 'COMP002_COMPONENT_ALREADY_EXISTS',
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
