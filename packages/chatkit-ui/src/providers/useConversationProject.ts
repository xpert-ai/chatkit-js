import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';

// The API persists this discriminator before the App can confirm its first Project.
function awaitsProjectConfirmation(
  conversation: Pick<ChatConversation, 'projectId' | 'options'>,
) {
  const creation = conversation.options?.projectCreation;
  return (
    !conversation.projectId &&
    typeof creation === 'object' &&
    creation !== null &&
    'status' in creation &&
    creation.status === 'awaiting_confirmation'
  );
}

/** Keep the persisted conversation scope separate from the StreamSession mount scope. */
export function useConversationProject({
  client,
  projectId,
  conversationId,
  threadId,
  isLoading,
  historyReady,
  historyMessageLoadVersion,
  onResolve,
}: {
  client: Pick<Client, 'conversations'>;
  projectId?: string;
  conversationId: string | null;
  threadId: string | null;
  isLoading: boolean;
  historyReady: boolean;
  historyMessageLoadVersion: number;
  onResolve?: (value: {
    threadId: string;
    conversation: ChatConversation;
  }) => void;
}) {
  const scope = JSON.stringify([conversationId, threadId]);
  const [resolved, setResolved] = useState<{
    scope: string;
    client: Pick<Client, 'conversations'>;
    projectId?: string;
    awaitingConfirmation: boolean;
    fromHistory?: boolean;
  } | null>(null);
  const lastRead = useRef<{
    client: typeof client;
    scope: string;
    revision: number;
    isLoading: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const hydrate = useCallback(
    (
      conversation: Pick<ChatConversation, 'id' | 'projectId' | 'options'>,
      loadedThreadId: string,
    ) => {
      lastRead.current = {
        client,
        scope: JSON.stringify([conversation.id, loadedThreadId]),
        revision,
        isLoading,
      };
      setResolved({
        scope: JSON.stringify([conversation.id, loadedThreadId]),
        client,
        projectId: conversation.projectId,
        awaitingConfirmation: awaitsProjectConfirmation(conversation),
        fromHistory: true,
      });
    },
    [client, revision, isLoading],
  );

  useEffect(() => {
    if (!conversationId || !threadId || !historyReady) return;
    const previous = lastRead.current;
    const next = { client, scope, revision, isLoading };
    if (
      previous?.client === client &&
      previous.scope === scope &&
      previous.revision === revision &&
      previous.isLoading === isLoading
    )
      return;
    let cancelled = false;
    void (async () => {
      try {
        const conversation = await client.conversations.get(conversationId);
        if (!cancelled && conversation.id === conversationId) {
          lastRead.current = next;
          onResolve?.({ threadId, conversation });
          setResolved((previous) => ({
            scope,
            client,
            projectId: conversation.projectId,
            awaitingConfirmation: awaitsProjectConfirmation(conversation),
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
    onResolve,
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
    projectId: hasResolvedScope
      ? resolved.projectId
      : loadingHistory
        ? undefined
        : projectId,
    resolved: loadingHistory || hasResolvedScope,
    fromHistory: hasResolvedScope && resolved.fromHistory === true,
    awaitingConfirmation: hasResolvedScope && resolved.awaitingConfirmation,
    refresh,
    hydrate,
  };
}
