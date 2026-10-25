/** Share pending reads only; each consumer owns cancellation, never another consumer's access. */
export class FileReadQueue<T> {
  private entries = new Map<string, Entry<T>>();
  private waiting: Entry<T>[] = [];
  private active = 0;

  constructor(private readonly concurrency = 4) {}

  read(
    key: string,
    signal: AbortSignal,
    load: (signal: AbortSignal) => Promise<T>,
    priority = 1,
  ): Promise<T> {
    signal.throwIfAborted();
    let entry = this.entries.get(key);
    if (!entry) {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      entry = {
        key,
        promise,
        resolve,
        reject,
        load,
        priority,
        controller: new AbortController(),
        subscribers: 0,
        started: false,
        settled: false,
      };
      this.entries.set(key, entry);
      this.waiting.push(entry);
      // Allow a discarded StrictMode effect to cancel before sending any request.
      queueMicrotask(() => this.pump());
    }
    entry.priority = Math.min(entry.priority, priority);
    entry.subscribers += 1;
    const current = entry;
    return new Promise((resolve, reject) => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        signal.removeEventListener('abort', abort);
        if (--current.subscribers === 0 && !current.settled) {
          if (this.entries.get(key) === current) this.entries.delete(key);
          current.controller.abort();
          if (!current.started) {
            this.waiting = this.waiting.filter((item) => item !== current);
            current.settled = true;
            current.reject(
              new DOMException('File read cancelled', 'AbortError'),
            );
          }
        }
      };
      const abort = () => {
        release();
        reject(
          signal.reason ??
            new DOMException('File read cancelled', 'AbortError'),
        );
      };
      signal.addEventListener('abort', abort, { once: true });
      void current.promise.then(
        (value) => {
          release();
          resolve(value);
        },
        (error: unknown) => {
          release();
          reject(error);
        },
      );
      if (signal.aborted) abort();
    });
  }

  private pump() {
    this.waiting.sort((a, b) => a.priority - b.priority);
    while (this.active < this.concurrency && this.waiting.length) {
      const entry = this.waiting.shift()!;
      entry.started = true;
      this.active += 1;
      void Promise.resolve()
        .then(() => {
          entry.controller.signal.throwIfAborted();
          return entry.load(entry.controller.signal);
        })
        .then(
          (value) => {
            finish();
            entry.resolve(value);
          },
          (error: unknown) => {
            finish();
            entry.reject(error);
          },
        );
      const finish = () => {
        entry.settled = true;
        if (this.entries.get(entry.key) === entry)
          this.entries.delete(entry.key);
        this.active -= 1;
        this.pump();
      };
    }
  }
}

type Entry<T> = {
  key: string;
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  load: (signal: AbortSignal) => Promise<T>;
  controller: AbortController;
  priority: number;
  subscribers: number;
  started: boolean;
  settled: boolean;
};
