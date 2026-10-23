import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client, Thread } from '@xpert-ai/xpert-sdk';
import { readFailure } from '../providers/stream/connection/read-recovery';

export function useThreadBranches(
  client: Client,
  conversationId: string | null,
  threadId: string | null,
  enabled: boolean,
  isLoading: boolean,
  readBranches?: () => Promise<Thread[]>,
) {
  const scope = useRef(threadId);
  scope.current = threadId;
  const [snapshot, setSnapshot] = useState<{
    threadId: string;
    branches: Thread[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!threadId || !conversationId || !enabled) return;
    const request = ++generation.current;
    try {
      const branches = await (readBranches
        ? readBranches()
        : client.conversations.listThreads(conversationId));
      if (scope.current !== threadId || generation.current !== request) return;
      setSnapshot({ threadId, branches });
      setError(null);
      setRetryPending(false);
    } catch (error) {
      if (scope.current !== threadId || generation.current !== request) return;
      setRetryPending(
        Boolean(readBranches) &&
          readFailure(error).retryable &&
          !(error instanceof Error && error.name === 'AbortError'),
      );
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
  }, [client, conversationId, enabled, threadId, readBranches]);
  const branches =
    enabled && snapshot?.threadId === threadId ? snapshot.branches : [];
  const current = branches.find((branch) => branch.thread_id === threadId);
  useEffect(() => {
    setError(null);
    setRetryPending(false);
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh, isLoading]);
  useEffect(() => {
    if (
      !enabled ||
      !threadId ||
      (!retryPending && !['busy', 'pausing'].includes(current?.status ?? ''))
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
  }, [enabled, threadId, current?.status, refresh, retryPending]);
  return { branches, current, error, refresh };
}
