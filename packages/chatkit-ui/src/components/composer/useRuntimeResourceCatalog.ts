import * as React from 'react';
import type {
  Client,
  RuntimeResourceCatalogItem,
  RuntimeResourceKind,
  RuntimeResourceReference,
} from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { ResourceDisplayItem } from './resource-display';

interface CachedCatalog {
  items: RuntimeResourceCatalogItem[];
  total: number;
  offset: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  expires: number;
}

type CatalogQuery = {
  kind?: RuntimeResourceKind;
  purpose?: 'selection';
  search: string;
  references?: RuntimeResourceReference[];
};
const catalogKey = ({ kind, search, purpose, references }: CatalogQuery) =>
  JSON.stringify([kind ?? 'all', search, purpose ?? 'browse', references]);
const resourceKey = ({ bindingId, version }: RuntimeResourceReference) =>
  JSON.stringify([bindingId, version]);
const noSelection: RuntimeResourceReference[] = [];
const noItems: RuntimeResourceCatalogItem[] = [];
export const RESOURCE_CATALOG_TTL_MS = 60_000;

/** One cache per client / Assistant / project. Menu navigation never invalidates it. */
export function useRuntimeResourceCatalog({
  client,
  assistantId,
  projectId,
  enabled,
  browseEnabled = true,
  query,
  kind,
  selectedResources = noSelection,
}: {
  client: Client<unknown>;
  assistantId: string;
  projectId?: string | null;
  enabled: boolean;
  browseEnabled?: boolean;
  query: string;
  kind?: RuntimeResourceKind;
  selectedResources?: RuntimeResourceReference[];
}) {
  const { t } = useChatkitTranslation();
  const cache = React.useMemo(
    () => ({
      scope: { client, assistantId, projectId },
      entries: new Map<string, CachedCatalog>(),
      known: new Map<string, RuntimeResourceCatalogItem>(),
      // Historical metadata is presentation-only; it is never proof of availability.
      history: new Map<string, RuntimeResourceCatalogItem>(),
      verified: new Map<string, ResourceDisplayItem['status']>(),
      controllers: new Set<AbortController>(),
    }),
    [client, assistantId, projectId],
  );
  const [revision, redraw] = React.useReducer((value) => value + 1, 0);
  const [actionError, setLoadError] = React.useState<string | null>(null);
  const hasSelected = selectedResources.length > 0;
  const search = query.trim();
  const key = catalogKey({ kind, search });
  const fullCatalog = React.useMemo<CatalogQuery>(
    () => ({
      search: '',
      purpose: 'selection',
      references: selectedResources.map(({ bindingId, version }) => ({
        bindingId,
        version,
      })),
    }),
    [selectedResources],
  );
  const selectedKey = catalogKey(fullCatalog);

  const refresh = React.useCallback(() => {
    for (const controller of cache.controllers) controller.abort();
    cache.controllers.clear();
    cache.entries.clear();
    cache.known.clear();
    cache.verified.clear();
    setLoadError(null);
    redraw();
  }, [cache]);

  React.useEffect(() => {
    setLoadError(null);
    const refreshExpired = () => {
      let changed = false;
      for (const [key, entry] of cache.entries) {
        if (!entry.loading && entry.expires <= Date.now()) {
          cache.entries.delete(key);
          for (const item of entry.items) cache.known.delete(resourceKey(item));
          changed = true;
        }
      }
      if (changed) {
        cache.verified.clear();
        setLoadError(null);
        redraw();
      }
    };
    window.addEventListener('focus', refreshExpired);
    return () => {
      window.removeEventListener('focus', refreshExpired);
      for (const controller of cache.controllers) controller.abort();
    };
  }, [cache, refresh]);

  const load = React.useCallback(
    async (target: CatalogQuery, more = false) => {
      const { client, assistantId, projectId } = cache.scope;
      const key = catalogKey(target);
      const existing = cache.entries.get(key);
      if (
        existing?.loading ||
        (!more &&
          existing &&
          existing.expires > Date.now() &&
          (existing.loaded || existing.error))
      )
        return;
      const entry: CachedCatalog = (existing && existing.expires > Date.now()
        ? existing
        : undefined) ?? {
        items: [],
        total: 0,
        offset: 0,
        loading: false,
        loaded: false,
        error: null,
        expires: 0,
      };
      cache.entries.set(key, entry);
      entry.loading = true;
      entry.error = null;
      const abort = new AbortController();
      cache.controllers.add(abort);
      redraw();
      try {
        const options = {
          projectId: projectId ?? undefined,
          search: target.search || undefined,
          kind: target.kind,
          ...(target.purpose ? { purpose: target.purpose } : {}),
          ...(target.references ? { references: target.references } : {}),
          offset: entry.offset,
          limit: 100,
          signal: abort.signal,
        };
        const result = await client.assistants.getResources(
          assistantId,
          options,
        );
        if (abort.signal.aborted) return;
        entry.total = result.total;
        entry.offset += result.items.length;
        for (const item of result.items) {
          cache.known.set(resourceKey(item), item);
          cache.history.set(resourceKey(item), item);
          if (!entry.items.some((value) => value.bindingId === item.bindingId))
            entry.items.push(item);
        }
        // Stop on empty pages even when a concurrently changing catalog has an old total.
        if (!result.items.length) {
          entry.total = entry.offset;
        }
        entry.loaded = true;
      } catch (reason) {
        if (!abort.signal.aborted)
          entry.error =
            reason instanceof Error ? reason.message : String(reason);
      } finally {
        cache.controllers.delete(abort);
        entry.loading = false;
        entry.expires = Date.now() + RESOURCE_CATALOG_TTL_MS;
        if (!abort.signal.aborted) redraw();
      }
    },
    [cache],
  );

  React.useEffect(() => {
    if (!enabled || !browseEnabled) return;
    const entry = cache.entries.get(key);
    if (entry && (entry.loading || entry.expires > Date.now())) return;
    const timer = window.setTimeout(
      () => void load({ kind, search }),
      search ? 150 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [enabled, browseEnabled, cache, key, load, search, kind, revision]);

  // Restore labels/status for assistant-role packages without offering them in menus.
  // Selection inventory has its own cache, independent of candidate menu/search.
  // Resolve exact references before treating a missing version as unavailable.
  React.useEffect(() => {
    if (!enabled || !hasSelected) return;
    const entry = cache.entries.get(selectedKey);
    if (
      entry?.loading ||
      (entry && entry.expires > Date.now() && (entry.error || entry.loaded))
    )
      return;
    const timer = window.setTimeout(() => void load(fullCatalog), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, hasSelected, selectedKey, fullCatalog, cache, load, revision]);

  const completeCatalog = cache.entries.get(selectedKey);
  const fullItems = completeCatalog?.items ?? noItems;
  const complete =
    !!completeCatalog?.loaded &&
    completeCatalog.offset >= completeCatalog.total;
  React.useEffect(() => {
    if (!enabled || !complete) return;
    for (const resource of selectedResources) {
      const key = resourceKey(resource);
      if (
        fullItems.some((item) => resourceKey(item) === key) ||
        cache.verified.has(key)
      )
        continue;
      const abort = new AbortController();
      cache.controllers.add(abort);
      cache.verified.set(key, 'checking');
      // A superseded version may still be valid for an existing conversation.
      // Validation does not persist or upgrade the version-pinned selection.
      void client.assistants
        .validateResources(
          assistantId,
          {
            revision: 0,
            resources: [
              { bindingId: resource.bindingId, version: resource.version },
            ],
          },
          projectId ?? undefined,
        )
        .then(() => {
          if (!abort.signal.aborted)
            cache.verified.set(key, 'previous_version');
        })
        .catch((reason: unknown) => {
          if (abort.signal.aborted) return;
          const rejected =
            reason instanceof Error &&
            'status' in reason &&
            typeof reason.status === 'number' &&
            [400, 403, 404, 409, 422].includes(reason.status);
          cache.verified.set(key, rejected ? 'unavailable' : 'unverified');
        })
        .finally(() => {
          cache.controllers.delete(abort);
          if (!abort.signal.aborted) redraw();
        });
    }
  }, [
    enabled,
    complete,
    fullItems,
    cache,
    selectedResources,
    client,
    assistantId,
    projectId,
    revision,
  ]);

  const selectedItems = selectedResources.map(
    (resource): ResourceDisplayItem => {
      const key = resourceKey(resource);
      const exact = complete
        ? fullItems.find((item) => resourceKey(item) === key)
        : undefined;
      if (exact) return exact;
      const current = completeCatalog?.items.find(
        (item) => item.bindingId === resource.bindingId,
      );
      const previous = cache.history.get(key);
      return {
        // Do not borrow another version's components, descriptions or bound views.
        ...(previous ?? {
          title: current?.title ?? t('composer.resources.selectedVersion'),
          kind: current?.kind ?? 'agent_plugin',
          icon: current?.icon,
          avatar: current?.avatar,
          iconDefinition: current?.iconDefinition,
          components: [],
          diagnostics: [],
        }),
        ...resource,
        status:
          cache.verified.get(key) ??
          (completeCatalog?.error ? 'unverified' : 'checking'),
      };
    },
  );

  const entry = cache.entries.get(key);
  const items = entry?.items ?? noItems;
  return {
    items,
    known: cache.known,
    selectedItems,
    total: entry?.total ?? 0,
    loading: enabled && browseEnabled && (!entry || entry.loading),
    loadError:
      actionError ||
      entry?.error ||
      (hasSelected && completeCatalog?.error) ||
      null,
    setLoadError,
    refresh,
    more: () => void load({ kind, search }, true),
  };
}
