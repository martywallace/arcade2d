import { ErrorCode } from './error.constants';

/**
 * Engine-thrown error carrying a machine-readable {@link ErrorCode} and an
 * optional context bag of values relevant to the failure (the offending
 * host, key, component type, etc.). Every fault originating inside the
 * arcade2d engine surfaces as an `EngineError` — `instanceof EngineError`
 * is the supported way to filter engine faults from unrelated thrown
 * values in user `try/catch` blocks.
 *
 * Construct via {@link throwEngineError} rather than `throw new
 * EngineError(...)` so the throw site is uniform across the codebase.
 */
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
