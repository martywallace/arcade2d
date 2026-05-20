import { ErrorCode } from './error.constants';
import { EngineError } from './error';

/**
 * Throws an {@link EngineError} carrying the given {@link ErrorCode},
 * message, and optional context bag. The return type is `never` so the
 * compiler treats a call to this helper as a terminating statement —
 * callers don't need a redundant `return` after it.
 *
 * Engine code throws exclusively through this helper rather than `throw
 * new EngineError(...)` so the codepath is uniform and easy to grep for,
 * and so a future hook (telemetry, structured logging) has a single
 * chokepoint to plug into.
 *
 * @param code The {@link ErrorCode} identifying the failure. Part of the
 * public contract; pick the most specific code that applies, and add a
 * new entry to the enum before introducing a new failure class.
 * @param message Human-readable description of the failure. Surfaces in
 * the thrown error's `.message`.
 * @param context Optional bag of additional values attached to the
 * thrown error for downstream inspection (e.g. the offending host,
 * key, or component type). Stored on `EngineError.context`.
 */
export function throwEngineError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>,
): never {
  throw new EngineError(code, message, context);
}
