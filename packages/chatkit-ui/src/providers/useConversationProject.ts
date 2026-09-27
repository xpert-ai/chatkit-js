import { useCallback, useEffect, useState } from 'react';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';

/** Keep the persisted conversation scope separate from the StreamSession mount scope. */
export function useConversationProject({
  client,
  projectId,
  conversationId,
  threadId,
  isLoading,
  historyReady,
  historyMessageLoadVersion,
}: {
  client: Pick<Client, 'conversations'>;
  projectId?: string;
  conversationId: string | null;
  threadId: string | null;
  isLoading: boolean;
  historyReady: boolean;
  historyMessageLoadVersion: number;
}) {
  const scope = JSON.stringify([conversationId, threadId]);
  const [resolved, setResolved] = useState<{
    scope: string;
    client: Pick<Client, 'conversations'>;
    projectId?: string;
    fromHistory?: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const hydrate = useCallback(
    (
      conversation: Pick<ChatConversation, 'id' | 'projectId'>,
      loadedThreadId: string,
    ) => {
      setResolved({
        scope: JSON.stringify([conversation.id, loadedThreadId]),
        client,
        projectId: conversation.projectId,
        fromHistory: true,
      });
    },
    [client],
  );

  useEffect(() => {
    if (!conversationId || !threadId || !historyReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const conversation = await client.conversations.get(conversationId);
        if (!cancelled && conversation.id === conversationId) {
          setResolved((previous) => ({
            scope,
            client,
            projectId: conversation.projectId,
            fromHistory:
              previous?.scope === scope &&
              previous.client === client &&
              previous.fromHistory,
          }));
        }
      } catch {
        // A transient metadata failure must not interrupt the run or erase a
        // known scope. Conversation start/end and history reload retry it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    client,
    projectId,
    conversationId,
    threadId,
    scope,
    revision,
    isLoading,
    historyReady,
    historyMessageLoadVersion,
  ]);

  const hasResolvedScope =
    resolved?.scope === scope && resolved.client === client;
  const loadingHistory = Boolean(threadId && !historyReady);
  return {
    projectId: loadingHistory
      ? undefined
      : hasResolvedScope
        ? resolved.projectId
        : projectId,
    resolved: loadingHistory || hasResolvedScope,
    fromHistory: hasResolvedScope && resolved.fromHistory === true,
    refresh,
    hydrate,
  };
}
