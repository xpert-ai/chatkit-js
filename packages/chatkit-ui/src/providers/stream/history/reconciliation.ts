export const STREAM_RECONCILIATION_INTERVAL_MS = 2_000;

export const STREAM_RECONCILIATION_MAX_ATTEMPTS = 300;

export const STREAM_RECONCILIATION_MAX_CONSECUTIVE_FAILURES = 3;

export function waitForAbortableDelay(signal: AbortSignal, delay: number) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      signal.removeEventListener('abort', finish);
      resolve();
    };
    timeout = setTimeout(finish, delay);
    signal.addEventListener('abort', finish, { once: true });
  });
}
