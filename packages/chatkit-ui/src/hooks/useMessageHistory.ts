import * as React from 'react';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';
import type { ThreadHistoryScope, ThreadItem } from './useThreads';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';

const PAGE_SIZE = 50;

type HistoryRequest = {
  client: Client;
  assistantId: string;
  projectId: string | null | undefined;
  search: string;
  enabled: boolean;
};

type HistoryPage = {
  request: HistoryRequest;
  records: ChatConversation[];
  total: number;
  nextOffset: number | null;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  moreError: boolean;
};

/** Keep browsing and search independent from the active conversation's metadata. */
export function useMessageHistory({
  client,
  assistantId,
  projectId,
  enabled,
  query,
  scope,
}: {
  client: Client;
  assistantId: string;
  projectId?: string | null;
  enabled: boolean;
  query: string;
  scope: ThreadHistoryScope;
}) {
  const { t } = useChatkitTranslation();
  const filterProjectId =
    scope === 'no-project'
      ? null
      : scope === 'current-project'
        ? projectId
        : undefined;
  const search = query.trim();
  const request = React.useMemo<HistoryRequest>(
    () => ({
      client,
      assistantId,
      projectId: filterProjectId,
      search,
      enabled,
    }),
    [client, assistantId, filterProjectId, search, enabled],
  );
  const [page, setPage] = React.useState<HistoryPage | null>(null);
  const pending = React.useRef<{
    controller: AbortController;
    timer?: ReturnType<typeof setTimeout>;
    busy: boolean;
  } | null>(null);

  const cancelRequest = React.useCallback(() => {
    pending.current?.controller.abort();
    clearTimeout(pending.current?.timer);
  }, []);

  const fetchPage = React.useCallback(
    (offset: number, append: boolean, delay = 0) => {
      cancelRequest();
      if (!request.enabled) return;
      const task = {
        controller: new AbortController(),
        busy: true,
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
      };
      pending.current = task;
      setPage((previous) => ({
        request,
        records: previous?.request === request ? previous.records : [],
        total: previous?.request === request ? previous.total : 0,
        nextOffset: previous?.request === request ? previous.nextOffset : null,
        loading: !append,
        loadingMore: append,
        error: false,
        moreError: false,
      }));
      task.timer = setTimeout(() => {
        void request.client.conversations
          .search(
            {
              where: {
                xpertId: request.assistantId,
                ...(request.projectId === undefined
                  ? {}
                  : { projectId: request.projectId }),
              },
              search: request.search,
              limit: PAGE_SIZE,
              offset,
              order: { updatedAt: 'DESC', id: 'DESC' },
            },
            { signal: task.controller.signal },
          )
          .then((result) => {
            if (task.controller.signal.aborted) return;
            const nextOffset = offset + result.items.length;
            setPage((previous) => {
              const records = Array.from(
                new Map(
                  [
                    ...(append && previous?.request === request
                      ? previous.records
                      : []),
                    ...result.items,
                  ].map((record) => [record.id, record]),
                ).values(),
              );
              const total =
                typeof result.total === 'number'
                  ? result.total
                  : records.length;
              const hasMore =
                result.items.length > 0 &&
                (typeof result.total === 'number'
                  ? nextOffset < total
                  : result.items.length === PAGE_SIZE);
              return {
                request,
                records,
                total,
                nextOffset: hasMore ? nextOffset : null,
                loading: false,
                loadingMore: false,
                error: false,
                moreError: false,
              };
            });
          })
          .catch(() => {
            if (task.controller.signal.aborted) return;
            setPage((previous) =>
              previous?.request === request
                ? {
                    ...previous,
                    loading: false,
                    loadingMore: false,
                    error: !append,
                    moreError: append,
                  }
                : previous,
            );
          })
          .finally(() => {
            task.busy = false;
          });
      }, delay);
    },
    [cancelRequest, request],
  );

  React.useEffect(() => {
    fetchPage(0, false, search ? 200 : 0);
    return cancelRequest;
  }, [cancelRequest, fetchPage, search]);

  const current = page?.request === request && enabled ? page : null;
  const records = current?.records;
  const projectCache = React.useMemo(
    () => ({ client, assistantId, names: new Map<string, string>() }),
    [client, assistantId],
  );
  const [projectNames, setProjectNames] = React.useState<{
    cache: typeof projectCache;
    names: Record<string, string>;
  } | null>(null);

  React.useEffect(() => {
    if (!records?.length || !client.projects?.get) return;
    const controller = new AbortController();
    const ids = Array.from(
      new Set(
        records
          .map((record) => record.projectId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    void Promise.all(
      ids.map(async (id) => {
        if (projectCache.names.has(id)) return;
        try {
          const project = await client.projects.get(id, {
            signal: controller.signal,
          });
          if (!controller.signal.aborted)
            projectCache.names.set(id, project.name?.trim() ?? '');
        } catch {
          if (!controller.signal.aborted) projectCache.names.set(id, '');
        }
      }),
    ).then(() => {
      if (!controller.signal.aborted) {
        setProjectNames({
          cache: projectCache,
          names: Object.fromEntries(projectCache.names),
        });
      }
    });
    return () => controller.abort();
  }, [client, records, projectCache]);

  const threads = React.useMemo<ThreadItem[]>(
    () =>
      (records ?? []).map((record) => {
        const timestamp = record.updatedAt ? Date.parse(record.updatedAt) : NaN;
        return {
          id: record.threadId || record.id,
          recordId: record.id,
          title: record.title?.trim() || t('history.threadFallback'),
          projectId: record.projectId ?? null,
          projectName:
            projectNames?.cache === projectCache && record.projectId
              ? projectNames.names[record.projectId]
              : undefined,
          status: record.status ?? 'idle',
          lastMessageAt: Number.isNaN(timestamp)
            ? undefined
            : new Date(timestamp),
        };
      }),
    [records, projectNames, projectCache, t],
  );

  return {
    threads,
    total: current?.total ?? 0,
    isLoading: current?.loading ?? enabled,
    isLoadingMore: current?.loadingMore ?? false,
    error: current?.error ?? false,
    loadMoreError: current?.moreError ?? false,
    hasMore: current?.nextOffset != null,
    remove: (recordId: string) => {
      setPage((previous) => {
        if (
          previous?.request !== request ||
          !previous.records.some((record) => record.id === recordId)
        )
          return previous;
        return {
          ...previous,
          records: previous.records.filter((record) => record.id !== recordId),
          total: Math.max(0, previous.total - 1),
          nextOffset:
            previous.nextOffset === null
              ? null
              : Math.max(0, previous.nextOffset - 1),
        };
      });
    },
    refresh: () => fetchPage(0, false),
    loadMore: () => {
      if (current?.nextOffset != null && !pending.current?.busy) {
        fetchPage(current.nextOffset, true);
      }
    },
  };
}
