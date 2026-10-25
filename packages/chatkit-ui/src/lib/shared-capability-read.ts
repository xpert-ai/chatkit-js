/** Share pending reads only. Settled results never become an authorization cache. */
export function createSharedCapabilityRead<T>() {
  type Entry = {
    key: readonly unknown[];
    promise: Promise<T>;
    controller: AbortController;
    subscribers: number;
  };
  const clients = new WeakMap<object, Set<Entry>>();

  return (
    client: object,
    key: readonly unknown[],
    read: (signal: AbortSignal) => Promise<T>,
  ) => {
    let entries = clients.get(client);
    if (!entries) {
      entries = new Set();
      clients.set(client, entries);
    }
    let entry = [...entries].find(
      (candidate) =>
        candidate.key.length === key.length &&
        candidate.key.every((value, index) => Object.is(value, key[index])),
    );
    if (!entry) {
      const controller = new AbortController();
      // React can dispose an initial effect before committing its replacement (StrictMode).
      const promise = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return read(controller.signal);
      });
      entry = { key, promise, controller, subscribers: 0 };
      entries.add(entry);
      const pending = entry;
      const forget = () => entries.delete(pending);
      void promise.then(forget, forget);
    }
    entry.subscribers += 1;
    const acquired = entry;
    let released = false;
    return {
      promise: acquired.promise,
      release: () => {
        if (released) return;
        released = true;
        if (--acquired.subscribers === 0) {
          entries.delete(acquired);
          acquired.controller.abort();
        }
      },
    };
  };
}
