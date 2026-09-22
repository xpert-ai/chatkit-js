import * as React from 'react';
import { resourceDescriptionSearchText } from './resource-description';
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
}

type CatalogQuery = {
  kind?: RuntimeResourceKind;
  search: string;
  allPages: boolean;
};
const catalogKey = ({ kind, search }: CatalogQuery) =>
  JSON.stringify([kind ?? 'all', search]);
const resourceKey = ({ bindingId, version }: RuntimeResourceReference) =>
  JSON.stringify([bindingId, version]);
const noSelection: RuntimeResourceReference[] = [];
const noItems: RuntimeResourceCatalogItem[] = [];
const fullCatalog: CatalogQuery = { search: '', allPages: true };

/** One cache per client / Assistant / project. Menu navigation never invalidates it. */
export function useRuntimeResourceCatalog({
  client,
  assistantId,
  projectId,
  enabled,
  query,
  kind,
  selectedResources = noSelection,
}: {
  client: Client<unknown>;
  assistantId: string;
  projectId?: string | null;
  enabled: boolean;
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
  const allPages =
    kind === 'middleware' ||
    kind === 'external_xpert' ||
    (!kind && hasSelected);
  const search = kind === 'agent_plugin' ? query.trim() : '';
  const key = catalogKey({ kind, search, allPages });

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
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      for (const controller of cache.controllers) controller.abort();
    };
  }, [cache, refresh]);

  const load = React.useCallback(
    async (target: CatalogQuery, more = false) => {
      const { client, assistantId, projectId } = cache.scope;
      const key = catalogKey(target);
      const existing = cache.entries.get(key);
      if (existing?.loading || (!more && (existing?.loaded || existing?.error)))
        return;
      const entry: CachedCatalog = existing ?? {
        items: [],
        total: 0,
        offset: 0,
        loading: false,
        loaded: false,
        error: null,
      };
      cache.entries.set(key, entry);
      entry.loading = true;
      entry.error = null;
      const abort = new AbortController();
      cache.controllers.add(abort);
      redraw();
      try {
        do {
          const result = await client.assistants.getResources(assistantId, {
            projectId: projectId ?? undefined,
            search: target.search || undefined,
            kind: target.kind,
            offset: entry.offset,
            limit: 100,
            signal: abort.signal,
          });
          if (abort.signal.aborted) return;
          entry.total = result.total;
          entry.offset += result.items.length;
          for (const item of result.items) {
            cache.known.set(resourceKey(item), item);
            cache.history.set(resourceKey(item), item);
            if (
              !entry.items.some((value) => value.bindingId === item.bindingId)
            )
              entry.items.push(item);
          }
          // Stop on empty pages even when a concurrently changing catalog has an old total.
          if (!result.items.length) {
            entry.total = entry.offset;
            break;
          }
        } while (target.allPages && entry.offset < entry.total);
        entry.loaded = true;
      } catch (reason) {
        if (!abort.signal.aborted)
          entry.error =
            reason instanceof Error ? reason.message : String(reason);
      } finally {
        cache.controllers.delete(abort);
        entry.loading = false;
        if (!abort.signal.aborted) redraw();
      }
    },
    [cache],
  );

  React.useEffect(() => {
    if (!enabled || cache.entries.has(key)) return;
    const timer = window.setTimeout(
      () => void load({ kind, search, allPages }),
      search ? 150 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [enabled, cache, key, load, search, kind, allPages, revision]);

  // Resolve selections against the unfiltered catalog, independently of menu/search.
  // Finish pagination before treating a missing item as an old or removed version.
  React.useEffect(() => {
    if (!enabled || !hasSelected) return;
    const entry = cache.entries.get(catalogKey(fullCatalog));
    if (
      entry?.loading ||
      entry?.error ||
      (entry?.loaded && entry.offset >= entry.total)
    )
      return;
    const timer = window.setTimeout(
      () => void load(fullCatalog, !!entry?.loaded),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [enabled, hasSelected, cache, load, revision]);

  const completeCatalog = cache.entries.get(catalogKey(fullCatalog));
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
  const items =
    allPages && query.trim()
      ? (entry?.items ?? []).filter((item) =>
          `${item.title} ${resourceDescriptionSearchText(item.description)}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        )
      : (entry?.items ?? []);
  return {
    items,
    known: cache.known,
    selectedItems,
    total: allPages ? items.length : (entry?.total ?? 0),
    loading: enabled && (!entry || entry.loading),
    loadError:
      actionError ||
      entry?.error ||
      (hasSelected && completeCatalog?.error) ||
      null,
    setLoadError,
    refresh,
    more: () => void load({ kind, search, allPages }, true),
  };
}
