import * as React from 'react';

import type { Metadata, Thread } from '@xpert-ai/xpert-sdk';

import type { Conversation } from '../components/history/HistorySidebar';
import { useStreamContext } from '../providers/Stream';

type CreateThreadInput = {
  threadId?: string;
  title?: string;
  metadata?: Metadata;
};

type UseThreadsResult = {
  threads: Thread[];
  conversations: Conversation[];
  isLoading: boolean;
  error: unknown;
  refreshThreads: () => Promise<void>;
  createThread: (input?: CreateThreadInput) => Promise<Thread>;
  updateThreadMetadata: (threadId: string, metadata: Metadata) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
};

const DEFAULT_LIMIT = 50;

const getMetadataTitle = (metadata: Metadata | null | undefined): string | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>).title ??
    (metadata as Record<string, unknown>).name;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
};

const getThreadTitle = (thread: Thread): string => {
  const title = getMetadataTitle(thread.metadata);
  if (title) return title;
  const suffix = thread.thread_id.slice(0, 8);
  return suffix ? `Conversation ${suffix}` : 'Conversation';
};

const toDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp);
};

const toConversation = (thread: Thread): Conversation => ({
  id: thread.thread_id,
  title: getThreadTitle(thread),
  lastMessageAt: toDate(thread.updated_at),
});

const sortThreads = (threads: Thread[]): Thread[] => {
  return [...threads].sort((a, b) => {
    const aTime = Date.parse(a.updated_at);
    const bTime = Date.parse(b.updated_at);
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
};

const mergeMetadata = (base: Metadata | null | undefined, patch: Metadata): Metadata => {
  return {
    ...(base ?? {}),
    ...patch,
  };
};

export function useThreads(limit: number = DEFAULT_LIMIT): UseThreadsResult {
  const { client, threadId } = useStreamContext();
  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const upsertThread = React.useCallback((thread: Thread) => {
    setThreads((prev) => {
      const next = prev.filter((item) => item.thread_id !== thread.thread_id);
      return sortThreads([thread, ...next]);
    });
  }, []);

  const refreshThreads = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await client.threads.search({
        limit,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });
      setThreads(items);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [client, limit]);

  const createThread = React.useCallback(
    async (input?: CreateThreadInput) => {
      setError(null);
      const metadata = input?.metadata ?? {};
      const nextMetadata =
        input?.title || Object.keys(metadata).length > 0
          ? mergeMetadata(metadata, input?.title ? { title: input.title } : {})
          : undefined;
      const payload: { threadId?: string; metadata?: Metadata } = {};
      if (input?.threadId) payload.threadId = input.threadId;
      if (nextMetadata) payload.metadata = nextMetadata;
      const created = await client.threads.create(payload);
      upsertThread(created);
      return created;
    },
    [client, upsertThread],
  );

  const updateThreadMetadata = React.useCallback(
    async (id: string, metadata: Metadata) => {
      setError(null);
      const existing = threads.find((item) => item.thread_id === id)?.metadata ?? {};
      const updated = await client.threads.update(id, {
        metadata: mergeMetadata(existing, metadata),
      });
      upsertThread(updated);
      return updated;
    },
    [client, threads, upsertThread],
  );

  const deleteThread = React.useCallback(
    async (id: string) => {
      setError(null);
      await client.threads.delete(id);
      setThreads((prev) => prev.filter((item) => item.thread_id !== id));
    },
    [client],
  );

  React.useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  React.useEffect(() => {
    if (!threadId) return;
    if (threads.some((item) => item.thread_id === threadId)) return;
    void client.threads
      .get(threadId)
      .then((thread) => {
        upsertThread(thread);
      })
      .catch((err) => {
        setError(err);
      });
  }, [client, threadId, threads, upsertThread]);

  const conversations = React.useMemo(
    () => threads.map((thread) => toConversation(thread)),
    [threads],
  );

  return {
    threads,
    conversations,
    isLoading,
    error,
    refreshThreads,
    createThread,
    updateThreadMetadata,
    deleteThread,
  };
}
