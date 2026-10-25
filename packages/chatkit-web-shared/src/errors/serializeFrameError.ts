import { FrameSafeHttpError, HttpError } from './HttpError';

/**
 * Host handlers may reject with DOM objects that postMessage cannot clone.
 * Send a cloneable error so the iframe's pending request settles instead of hanging at startup.
 */
export function serializeFrameError(error: unknown): unknown {
  if (error instanceof HttpError || error instanceof FrameSafeHttpError) {
    try {
      return structuredClone(
        error instanceof HttpError
          ? FrameSafeHttpError.fromHttpError(error)
          : error,
      );
    } catch {
      // A host may have attached uncloneable metadata; fall back to status only.
    }
  }
  // Error subclasses can clone successfully while losing custom HTTP fields.
  // Preserve only the response classification before crossing the frame boundary.
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    const message =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : 'ChatKit host request failed';
    return new FrameSafeHttpError(message, {
      status: error.status,
      statusText:
        'statusText' in error && typeof error.statusText === 'string'
          ? error.statusText
          : undefined,
      retryAfterMs: readRetryAfterMs(error),
    });
  }
  try {
    return structuredClone(error);
  } catch {
    const message =
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : 'ChatKit host request failed';

    // Do not forward the original cause or arbitrary properties: they may contain
    // ProgressEvent, XMLHttpRequest, callbacks, or other non-cloneable host state.
    return new Error(message);
  }
}

function readRetryAfterMs(error: object): number | undefined {
  if (
    'retryAfterMs' in error &&
    typeof error.retryAfterMs === 'number' &&
    Number.isFinite(error.retryAfterMs)
  ) {
    return Math.max(0, error.retryAfterMs);
  }
  // Angular HttpErrorResponse carries Retry-After in HttpHeaders; forward the
  // bounded primitive, not that host-specific object or the request body.
  if (
    !('headers' in error) ||
    !error.headers ||
    typeof error.headers !== 'object'
  )
    return;
  const headers = error.headers;
  if (!('get' in headers) || typeof headers.get !== 'function') return;
  const value: unknown = headers.get('Retry-After');
  if (typeof value !== 'string' || !value.trim()) return;
  const duration = /^\d+(\.\d+)?$/.test(value.trim())
    ? Number(value) * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(duration) ? Math.max(0, duration) : undefined;
}
