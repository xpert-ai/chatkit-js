import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client, Thread } from '@xpert-ai/xpert-sdk';

export function useThreadBranches(
  client: Client,
  conversationId: string | null,
  threadId: string | null,
  enabled: boolean,
  isLoading: boolean,
) {
  const scope = useRef(threadId);
  scope.current = threadId;
  const [snapshot, setSnapshot] = useState<{
    threadId: string;
    branches: Thread[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!threadId || !conversationId || !enabled) return;
    const request = ++generation.current;
    try {
      const branches = await client.conversations.listThreads(conversationId);
      if (scope.current !== threadId || generation.current !== request) return;
      setSnapshot({ threadId, branches });
      setError(null);
    } catch (error) {
      if (scope.current !== threadId || generation.current !== request) return;
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 404
      ) {
        setSnapshot(null);
        setError(null);
        return;
      }
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [client, conversationId, enabled, threadId]);
  const branches =
    enabled && snapshot?.threadId === threadId ? snapshot.branches : [];
  const current = branches.find((branch) => branch.thread_id === threadId);
  useEffect(() => {
    setError(null);
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh, isLoading]);
  useEffect(() => {
    if (
      !enabled ||
      !threadId ||
      !['busy', 'pausing'].includes(current?.status ?? '')
    )
      return;
    // HTTP acceptance is not pause completion. Poll independently of the SSE connection.
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh();
      if (!disposed) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [enabled, threadId, current?.status, refresh]);
  return { branches, current, error, refresh };
}
