import * as React from 'react';
import type {
  ChatConversationStatus,
  ChatConversation as ThreadRecord,
} from '@xpert-ai/xpert-sdk';
import { useStreamContext } from '../providers/Stream';
import { i18n, initI18n } from '../i18n';

type CreateThreadInput = {
  recordId?: string;
  threadId?: string;
  title?: string;
  options?: Record<string, unknown>;
};

type UseThreadsResult = {
  threads: ThreadItem[];
  rawThreads: ThreadRecord[];
  isLoading: boolean;
  error: unknown;
  refreshThreads: () => Promise<void>;
  createThread: (input?: CreateThreadInput) => Promise<ThreadRecord>;
  updateThread: (
    recordId: string,
    payload: Partial<ThreadRecord>,
  ) => Promise<ThreadRecord>;
  deleteThread: (recordId: string) => Promise<void>;
};

export type ThreadItem = {
  /**
   * Thread ID
   */
  id: string;
  /**
   * Conversation record ID
   */
  recordId: string;
  title: string;
  status: ChatConversationStatus;
  error?: string;
  lastMessageAt?: Date;
};

const DEFAULT_LIMIT = 50;

const getThreadTitle = (threadRecord: ThreadRecord): string => {
  const title = threadRecord.title?.trim();
  if (title) return title;
  initI18n();
  const suffix = (threadRecord.threadId ?? threadRecord.id ?? '').slice(0, 8);
  return suffix
    ? i18n.t('history.threadWithId', { id: suffix })
    : i18n.t('history.threadFallback');
};

const toDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp);
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const toThreadItem = (threadRecord: ThreadRecord): ThreadItem => ({
  id: threadRecord.threadId ?? threadRecord.id,
  recordId: threadRecord.id,
  title: getThreadTitle(threadRecord),
  status: threadRecord.status || 'idle',
  error: threadRecord.error,
  lastMessageAt: toDate(threadRecord.updatedAt),
});

const sortThreadRecords = (threadRecords: ThreadRecord[]): ThreadRecord[] => {
  return [...threadRecords].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt ?? '');
    const bTime = Date.parse(b.updatedAt ?? '');
    return (
      (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
    );
  });
};

export function useThreads(
  limit: number = DEFAULT_LIMIT,
  enabled: boolean = true,
): UseThreadsResult {
  const {
    client,
    threadId,
    assistantId,
    projectId,
    isReady,
    isLoading: isStreamLoading,
    error: streamError,
  } = useStreamContext();
  const [threadRecords, setThreadRecords] = React.useState<ThreadRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const upsertThreadRecord = React.useCallback((threadRecord: ThreadRecord) => {
    setThreadRecords((prev) => {
      const next = prev.filter((item) => item.id !== threadRecord.id);
      return sortThreadRecords([threadRecord, ...next]);
    });
  }, []);

  const refreshThreads = React.useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const { items } = await client.conversations.search({
        where: { xpertId: assistantId, ...(projectId ? { projectId } : {}) },
        limit,
        order: { updatedAt: 'DESC' },
      });
      setThreadRecords(items ?? []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled, limit, assistantId, projectId]);

  const createThread = React.useCallback(
    async (input?: CreateThreadInput) => {
      setError(null);
      const payload: Partial<ThreadRecord> = {
        xpertId: assistantId,
        ...(projectId ? { projectId } : {}),
      };
      if (input?.recordId) payload.id = input.recordId;
      if (input?.threadId) payload.threadId = input.threadId;
      if (input?.title) payload.title = input.title;
      if (input?.options) payload.options = input.options;

      const created = await client.conversations.create(payload);
      upsertThreadRecord(created);
      return created;
    },
    [assistantId, client, projectId, upsertThreadRecord],
  );

  const updateThread = React.useCallback(
    async (recordId: string, payload: Partial<ThreadRecord>) => {
      setError(null);
      const updated = await client.conversations.update(recordId, payload);
      upsertThreadRecord(updated);
      return updated;
    },
    [client, upsertThreadRecord],
  );

  const deleteThread = React.useCallback(
    async (recordId: string) => {
      setError(null);
      await client.conversations.delete(recordId);
      setThreadRecords((prev) => prev.filter((item) => item.id !== recordId));
    },
    [client],
  );

  React.useEffect(() => {
    // Only fetch threads when the client is authenticated
    if (!enabled || !isReady) return;
    void refreshThreads();
  }, [enabled, refreshThreads, isReady]);

  React.useEffect(() => {
    if (!threadId || !isStreamLoading) return;

    const now = new Date().toISOString();
    const busyStatus: ChatConversationStatus = 'busy';

    setThreadRecords((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const isCurrentThread =
          item.threadId === threadId || item.id === threadId;
        if (!isCurrentThread) return item;
        if (item.status === busyStatus && !item.error) return item;
        changed = true;
        return {
          ...item,
          status: busyStatus,
          error: undefined,
          updatedAt: now,
        };
      });
      return changed ? sortThreadRecords(next) : prev;
    });
  }, [threadId, isStreamLoading]);

  React.useEffect(() => {
    const message = getErrorMessage(streamError)?.trim();
    if (!threadId || !message) return;

    const now = new Date().toISOString();
    const errorStatus: ChatConversationStatus = 'error';

    setThreadRecords((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const isCurrentThread =
          item.threadId === threadId || item.id === threadId;
        if (!isCurrentThread) return item;
        if (item.status === errorStatus && item.error === message) return item;
        changed = true;
        return {
          ...item,
          status: errorStatus,
          error: message,
          updatedAt: now,
        };
      });
      return changed ? sortThreadRecords(next) : prev;
    });
  }, [threadId, streamError]);

  React.useEffect(() => {
    if (!isReady || !threadId || isStreamLoading) return;

    let cancelled = false;

    void client.conversations
      .search({ where: { threadId }, limit: 1 })
      .then((result) => {
        if (cancelled) return;
        const found = result.items?.[0];
        if (found) upsertThreadRecord(found);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true;
    };
  }, [client, threadId, upsertThreadRecord, isReady, isStreamLoading]);

  const threads = React.useMemo(
    () => threadRecords.map((threadRecord) => toThreadItem(threadRecord)),
    [threadRecords],
  );

  return {
    threads,
    rawThreads: threadRecords,
    isLoading,
    error,
    refreshThreads,
    createThread,
    updateThread,
    deleteThread,
  };
}
