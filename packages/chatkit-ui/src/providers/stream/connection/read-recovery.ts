// One retry schedule for recovery reads. Read failures never change execution state or dispatch commands.
import { combineRequestSignals } from '../../../lib/request-abort';
import { waitForAbortableDelay } from '../history/reconciliation';

export type ConnectionState = 'connected' | 'reconnecting' | 'unavailable';

export function readFailure(error: unknown) {
  const status =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : undefined;
  const retryAfterMs =
    error &&
    typeof error === 'object' &&
    'retryAfterMs' in error &&
    typeof error.retryAfterMs === 'number' &&
    Number.isFinite(error.retryAfterMs)
      ? Math.max(0, error.retryAfterMs)
      : 0;
  return {
    retryAfterMs,
    retryable:
      status === undefined ||
      status === 0 ||
      status === 408 ||
      status === 429 ||
      status >= 500,
  };
}

export class ConnectionUnavailableError extends Error {
  constructor() {
    super('The connection is temporarily unavailable.');
  }
}

export class ReadRecovery {
  private controller = new AbortController();
  private failures = new Map<string, number>();
  private pending = new Map<string, Promise<unknown>>();
  private listeners = new Set<() => void>();
  private nextReadAt = 0;
  private blocked = false;
  private state: ConnectionState = 'connected';
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly getSnapshot = () => this.state;
  get signal() {
    return this.controller.signal;
  }
  get stopped() {
    return this.blocked || this.signal.aborted;
  }

  reset() {
    this.controller.abort();
    this.controller = new AbortController();
    this.failures.clear();
    this.pending.clear();
    this.nextReadAt = 0;
    this.blocked = false;
    this.publish();
  }
  activate() {
    if (this.signal.aborted) this.controller = new AbortController();
  }
  dispose() {
    this.controller.abort();
  }
  private publish() {
    const next =
      this.blocked || [...this.failures.values()].some((n) => n >= 3)
        ? 'unavailable'
        : this.failures.size
          ? 'reconnecting'
          : 'connected';
    if (this.state === next) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
  succeeded(key: string) {
    if (this.stopped) return;
    this.failures.delete(key);
    if (!this.failures.size) this.nextReadAt = 0;
    this.publish();
  }
  failed(key: string, error: unknown) {
    if (this.stopped) return;
    const count = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, count);
    const failure = readFailure(error);
    this.blocked = !failure.retryable;
    if (this.blocked) this.controller.abort();
    const delay =
      Math.min(30_000, 1000 * 2 ** Math.min(count - 1, 5)) *
      (1 + Math.random() * 0.2);
    this.nextReadAt = Math.max(
      this.nextReadAt,
      Date.now() + Math.max(delay, failure.retryAfterMs),
    );
    this.publish();
  }
  async wait(signal?: AbortSignal) {
    const combined = combineRequestSignals([this.signal, signal]);
    while (!this.stopped && !combined?.aborted && Date.now() < this.nextReadAt)
      await waitForAbortableDelay(combined!, this.nextReadAt - Date.now());
    return !this.stopped && !combined?.aborted;
  }
  /** Keys identify the exact typed request, including thread/run and page; duplicate callers share its result. */
  async read<T>(
    key: string,
    operation: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const combined = combineRequestSignals([this.signal, signal])!;
    const promise = (async () => {
      if (!(await this.wait(combined)))
        throw new DOMException('Read cancelled', 'AbortError');
      try {
        const value = await operation(combined);
        if (combined.aborted || this.blocked)
          throw new DOMException('Read cancelled', 'AbortError');
        this.succeeded(key);
        return value;
      } catch (error) {
        if (!combined.aborted) this.failed(key, error);
        throw error;
      }
    })();
    this.pending.set(key, promise);
    try {
      return await promise;
    } finally {
      if (this.pending.get(key) === promise) this.pending.delete(key);
    }
  }
}
