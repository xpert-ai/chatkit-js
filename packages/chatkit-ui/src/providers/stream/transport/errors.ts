export function createAbortError(message: string): Error | DOMException {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }

  return new Error(message);
}

export function isAbortError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

export function normalizeSubmissionError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string' && error.trim()) {
    return new Error(error.trim());
  }

  if (error !== null && typeof error === 'object') {
    const message = Reflect.get(error, 'message');
    if (typeof message === 'string' && message.trim()) {
      return new Error(message.trim());
    }
  }

  return new Error('Failed to start the conversation.');
}

export function shouldIgnoreStreamError(
  error: unknown,
  signal: Pick<AbortSignal, 'aborted'>,
) {
  return signal.aborted || isAbortError(error);
}
