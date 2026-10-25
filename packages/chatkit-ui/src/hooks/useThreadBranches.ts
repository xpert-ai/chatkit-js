import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mergeThreadControlView,
  type Client,
  type Thread,
  type ThreadControlView,
} from '@xpert-ai/xpert-sdk';
import { readFailure } from '../providers/stream/connection/read-recovery';

export function useThreadBranches(
  client: Client,
  conversationId: string | null,
  threadId: string | null,
  enabled: boolean,
  isLoading: boolean,
  readBranches?: () => Promise<Thread[]>,
  readControl?: (threadId: string) => Promise<ThreadControlView>,
) {
  const scope = useRef(threadId);
  scope.current = threadId;
  const [snapshot, setSnapshot] = useState<{
    threadId: string;
    client: Client;
    branches: Thread[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const [controlUnavailable, setControlUnavailable] = useState(false);
  const generation = useRef(0);
  const flight = useRef<{ threadId: string; promise: Promise<void> } | null>(
    null,
  );
  const views = useRef(new Map<string, ThreadControlView>());
  const viewClient = useRef(client);
  if (viewClient.current !== client) {
    views.current.clear();
    viewClient.current = client;
  }

  const read = useCallback(async () => {
    if (!threadId || !conversationId || !enabled) return;
    if (flight.current?.threadId === threadId) return flight.current.promise;
    const request = ++generation.current;
    const work = async () => {
      try {
        const [branchResult, viewResult] = await Promise.allSettled([
          readBranches
            ? readBranches()
            : client.conversations.listThreads(conversationId),
          readControl
            ? readControl(threadId)
            : client.threads?.getControlView?.(threadId),
        ]);
        if (branchResult.status === 'rejected') throw branchResult.reason;
        if (viewResult.status === 'rejected') throw viewResult.reason;
        const branches = branchResult.value;
        const incoming = viewResult.value;
        if (scope.current !== threadId || generation.current !== request)
          return;
        const view = incoming
          ? mergeThreadControlView(views.current.get(threadId), incoming)
          : undefined;
        if (view) views.current.set(threadId, view);
        setSnapshot({
          client,
          threadId,
          branches: branches.map((branch) =>
            branch.thread_id === threadId && view
              ? { ...branch, controlView: view }
              : branch,
          ),
        });
        setError(null);
        setRetryPending(
          Boolean(
            incoming &&
            !branches.some((branch) => branch.thread_id === threadId),
          ),
        );
        setControlUnavailable(
          Boolean(
            incoming &&
            !branches.some((branch) => branch.thread_id === threadId),
          ),
        );
      } catch (error) {
        if (scope.current !== threadId || generation.current !== request)
          return;
        // Preserve the last confirmed view. A read failure never changes execution outcome.
        setControlUnavailable(Boolean(client.threads?.getControlView));
        setRetryPending(
          readFailure(error).retryable &&
            !(error instanceof Error && error.name === 'AbortError'),
        );
        if (
          typeof client.threads?.getControlView !== 'function' &&
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
    };
    const promise = work();
    flight.current = { threadId, promise };
    try {
      await promise;
    } finally {
      if (flight.current?.promise === promise) flight.current = null;
    }
  }, [client, conversationId, enabled, threadId, readBranches, readControl]);

  // A refresh following a control command must read after the command, not reuse a preceding request.
  const refresh = useCallback(async () => {
    const pending = flight.current;
    if (pending?.threadId === threadId) await pending.promise;
    if (scope.current === threadId) await read();
  }, [read, threadId]);
  const branches =
    enabled && snapshot?.threadId === threadId && snapshot.client === client
      ? snapshot.branches
      : [];
  const current = branches.find((branch) => branch.thread_id === threadId);
  useEffect(() => {
    setError(null);
    setRetryPending(false);
    setControlUnavailable(
      Boolean(enabled && threadId && client.threads?.getControlView),
    );
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh, isLoading]);
  useEffect(() => {
    if (
      !enabled ||
      !threadId ||
      (!retryPending &&
        !['busy', 'pausing'].includes(current?.status ?? '') &&
        ![
          'running',
          'pausing',
          'stopping',
          'settling',
          'input_required',
          'confirming',
        ].includes(current?.controlView?.state ?? ''))
    )
      return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await read();
      if (!disposed) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [
    enabled,
    threadId,
    current?.status,
    current?.controlView?.state,
    read,
    retryPending,
  ]);
  return {
    branches,
    current,
    error,
    refresh,
    controlUnavailable:
      controlUnavailable ||
      Boolean(
        enabled &&
        threadId &&
        typeof client.threads?.getControlView === 'function' &&
        (snapshot?.threadId !== threadId || snapshot?.client !== client),
      ),
  };
}
