import { useEffect, useRef, useState } from 'react';
import type { Client } from '@xpert-ai/xpert-sdk';
import type { HistoryRequest } from '../../useThreadHistory';

/** A deliberate project-picker action, distinct from creating a new chat. */
export type ProjectConversationRequest = { projectId: string | null };

export function useProjectConversation({
  request,
  client,
  assistantId,
  isReady,
  reset,
  captureHistoryRequest,
  loadThread,
  setError,
}: {
  request?: ProjectConversationRequest | null;
  client: Client;
  assistantId: string;
  isReady: boolean;
  reset: (
    threadId: null,
    messages: [],
    options: { suppressThreadChange: boolean },
  ) => void;
  captureHistoryRequest: () => HistoryRequest;
  loadThread: (threadId: string) => Promise<void>;
  setError: (error: unknown) => void;
}) {
  const callbacks = useRef({
    reset,
    captureHistoryRequest,
    loadThread,
    setError,
  });
  callbacks.current = { reset, captureHistoryRequest, loadThread, setError };
  const completed = useRef<ProjectConversationRequest | null>(null);
  const pendingHistoryRequest = useRef<HistoryRequest | null>(null);
  const [pending, setPending] = useState<ProjectConversationRequest | null>(
    null,
  );

  useEffect(() => {
    if (!request || !isReady || completed.current === request) return;
    const controller = new AbortController();
    callbacks.current.reset(null, [], { suppressThreadChange: true });
    const historyRequest = callbacks.current.captureHistoryRequest();
    pendingHistoryRequest.current = historyRequest;
    setPending(request);

    void client.conversations
      .search(
        {
          where: { xpertId: assistantId, projectId: request.projectId },
          limit: 1,
          order: { updatedAt: 'DESC', id: 'DESC' },
        },
        { signal: controller.signal },
      )
      .then(async ({ items }) => {
        if (controller.signal.aborted) return;
        completed.current = request;
        // Explicit history navigation or a new chat takes precedence over this lookup.
        if (!historyRequest.isCurrent()) return;
        const threadId = items[0]?.threadId;
        if (threadId) await callbacks.current.loadThread(threadId);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && historyRequest.isCurrent()) {
          completed.current = request;
          callbacks.current.setError(error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(null);
      });
    return () => controller.abort();
  }, [request, client, assistantId, isReady]);

  return Boolean(
    request &&
    ((pending === request && pendingHistoryRequest.current?.isCurrent()) ||
      (pending !== request && isReady && completed.current !== request)),
  );
}
