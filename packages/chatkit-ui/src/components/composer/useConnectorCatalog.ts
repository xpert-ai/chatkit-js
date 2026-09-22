import * as React from 'react';
import type { Client, ConnectorRuntimeOptions } from '@xpert-ai/xpert-sdk';

type Entry = {
  data?: ConnectorRuntimeOptions;
  error?: unknown;
  loading: boolean;
  loaded: boolean;
  revision: number;
  listeners: Set<() => void>;
};
const clients = new WeakMap<Client<unknown>, Map<string, Entry>>();
const notify = (entry: Entry) => {
  entry.revision++;
  entry.listeners.forEach((listener) => listener());
};

/** The client carries identity/organization headers; never cache across clients or scopes. */
export function invalidateConnectionCatalogs(client: Client<unknown>) {
  for (const entry of clients.get(client)?.values() ?? []) {
    entry.loaded = false;
    notify(entry);
  }
}

export function useConnectorCatalog(
  client: Client<unknown>,
  assistantId: string,
  projectId?: string | null,
  enabled = true,
) {
  const entry = React.useMemo(() => {
    let scopes = clients.get(client);
    if (!scopes) clients.set(client, (scopes = new Map()));
    const key = JSON.stringify([assistantId, projectId ?? null]);
    let cached = scopes.get(key);
    if (!cached)
      scopes.set(
        key,
        (cached = {
          loading: false,
          loaded: false,
          revision: 0,
          listeners: new Set(),
        }),
      );
    return cached;
  }, [client, assistantId, projectId]);
  const revision = React.useSyncExternalStore(
    React.useCallback(
      (listener) => {
        entry.listeners.add(listener);
        return () => {
          entry.listeners.delete(listener);
        };
      },
      [entry],
    ),
    () => entry.revision,
  );
  React.useEffect(() => {
    if (!enabled || !assistantId || entry.loaded || entry.loading) return;
    entry.loading = true;
    entry.error = undefined;
    notify(entry);
    const startedAt = entry.revision;
    void client.connectors
      .runtimeOptions(assistantId, {
        projectId: projectId ?? undefined,
        includeWorkspace: true,
      })
      .then((data) => {
        entry.data = data;
      })
      .catch((error: unknown) => {
        entry.error = error;
      })
      .finally(() => {
        entry.loading = false;
        entry.loaded = entry.revision === startedAt;
        notify(entry);
      });
  }, [entry, client, assistantId, projectId, enabled, revision]);
  React.useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      entry.loaded = false;
      notify(entry);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [entry, enabled]);
  return {
    data: entry.data,
    error: entry.error,
    loading: enabled && (!entry.loaded || entry.loading),
    refresh: () => invalidateConnectionCatalogs(client),
  };
}
