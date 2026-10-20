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

/** No acknowledgement is not proof of rejection: never roll back or resend this submission. */
export class UnconfirmedRunError extends Error {
  constructor(cause: unknown) {
    super(normalizeSubmissionError(cause).message, { cause });
    this.name = 'UnconfirmedRunError';
  }
}

export function isRunAdmissionRejected(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408
  );
}
