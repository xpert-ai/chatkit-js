import * as React from 'react';
import type { StreamContextType } from '../../../providers/stream/types';
import { createConversationThreadSearchWhere } from '../../../lib/conversation-runtime-capabilities';
import { useWorkbenchChat } from '../../../workbench/floating-chat/context';

/** Current metadata is independent of whether browsing history is enabled. */
export function useConversationTitle(
  stream: Pick<
    StreamContextType,
    | 'client'
    | 'assistantId'
    | 'conversationId'
    | 'threadId'
    | 'isReady'
    | 'isLoading'
  >,
  knownTitle: string | undefined,
  surface: 'main' | 'side',
) {
  const enabled = !!useWorkbenchChat() && surface === 'main';
  const { client, assistantId, conversationId, threadId, isReady, isLoading } =
    stream;
  const scope = JSON.stringify([assistantId, conversationId, threadId]);
  const [loaded, setLoaded] = React.useState<{
    scope: string;
    client: typeof client;
    title?: string;
  } | null>(null);
  React.useEffect(() => {
    const currentId = conversationId ?? threadId;
    if (!enabled || !isReady || knownTitle?.trim() || !currentId) return;
    let cancelled = false;
    const request = conversationId
      ? client.conversations.get(conversationId)
      : client.conversations
          .search({
            where: createConversationThreadSearchWhere(currentId, {
              xpertId: assistantId,
            }),
            limit: 1,
          })
          .then((result) => result.items?.[0]);
    void request
      .then((conversation) => {
        if (!cancelled)
          setLoaded({ scope, client, title: conversation?.title?.trim() });
      })
      .catch(() => {
        // The chat's existing error surface owns API failures; the title can fall back.
      });
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    client,
    scope,
    assistantId,
    conversationId,
    threadId,
    isReady,
    isLoading,
    knownTitle,
  ]);
  return (
    knownTitle?.trim() ||
    (loaded?.scope === scope && loaded.client === client
      ? loaded.title
      : undefined)
  );
}
