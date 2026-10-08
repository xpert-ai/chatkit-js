/** Match the SDK cancellation convention so aborted work is never retried. */
export function requestAborted(): DOMException {
  return new DOMException('AbortError: Request cancelled.', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal | null) {
  if (signal?.aborted) throw requestAborted();
}

/** Cancel only this waiter; other requests may still need the shared refresh. */
export function waitForCredentials<T>(
  promise: Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(requestAborted());
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

export function combineRequestSignals(
  signals: (AbortSignal | null | undefined)[],
): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal =>
    Boolean(signal),
  );
  if (!active.length) return undefined;
  if (active.length === 1) return active[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(active);
  // Older embedders and test DOMs do not expose AbortSignal.any.
  const controller = new AbortController();
  const abort = () => {
    controller.abort(requestAborted());
    active.forEach((signal) => signal.removeEventListener('abort', abort));
  };
  active.forEach((signal) =>
    signal.addEventListener('abort', abort, { once: true }),
  );
  if (active.some((signal) => signal.aborted)) abort();
  return controller.signal;
}
