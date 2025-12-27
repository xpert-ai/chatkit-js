import * as React from 'react';

import type { ChatConversation } from '@xpert-ai/xpert-sdk';

import type { Conversation } from '../components/history/HistorySidebar';
import { useStreamContext } from '../providers/Stream';

type CreateConversationInput = {
  conversationId?: string;
  threadId?: string;
  title?: string;
  options?: Record<string, unknown>;
};

type UseThreadsResult = {
  conversations: Conversation[];
  rawConversations: ChatConversation[];
  isLoading: boolean;
  error: unknown;
  refreshConversations: () => Promise<void>;
  createConversation: (input?: CreateConversationInput) => Promise<ChatConversation>;
  updateConversation: (
    conversationId: string,
    payload: Partial<ChatConversation>,
  ) => Promise<ChatConversation>;
  deleteConversation: (conversationId: string) => Promise<void>;
  // Legacy aliases kept for compatibility
  refreshThreads: () => Promise<void>;
  createThread: (input?: CreateConversationInput) => Promise<ChatConversation>;
  updateThreadMetadata: (
    conversationId: string,
    payload: Partial<ChatConversation>,
  ) => Promise<ChatConversation>;
  deleteThread: (conversationId: string) => Promise<void>;
};

const DEFAULT_LIMIT = 50;

const getConversationTitle = (conversation: ChatConversation): string => {
  const title = conversation.title?.trim();
  if (title) return title;
  const suffix = (conversation.id ?? conversation.threadId ?? '').slice(0, 8);
  return suffix ? `Conversation ${suffix}` : 'Conversation';
};

const toDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp);
};

const toConversation = (conversation: ChatConversation): Conversation => ({
  id: conversation.id,
  threadId: conversation.threadId ?? null,
  title: getConversationTitle(conversation),
  lastMessageAt: toDate(conversation.updatedAt),
});

const sortConversations = (conversations: ChatConversation[]): ChatConversation[] => {
  return [...conversations].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt ?? '');
    const bTime = Date.parse(b.updatedAt ?? '');
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
};

export function useThreads(limit: number = DEFAULT_LIMIT): UseThreadsResult {
  const { client, threadId } = useStreamContext();
  const [conversationsState, setConversationsState] = React.useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const upsertConversation = React.useCallback((conversation: ChatConversation) => {
    setConversationsState((prev) => {
      const next = prev.filter((item) => item.id !== conversation.id);
      return sortConversations([conversation, ...next]);
    });
  }, []);

  const refreshConversations = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { items } = await client.conversations.search({
        limit,
        order: { updatedAt: 'DESC' },
      });
      setConversationsState(items ?? []);
      console.log('Conversations refreshed', items);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [client, limit]);

  const createConversation = React.useCallback(
    async (input?: CreateConversationInput) => {
      setError(null);
      const payload: Partial<ChatConversation> = {};
      if (input?.conversationId) payload.id = input.conversationId;
      if (input?.threadId) payload.threadId = input.threadId;
      if (input?.title) payload.title = input.title;
      if (input?.options) payload.options = input.options;

      const created = await client.conversations.create(payload);
      upsertConversation(created);
      return created;
    },
    [client, upsertConversation],
  );

  const updateConversation = React.useCallback(
    async (id: string, payload: Partial<ChatConversation>) => {
      setError(null);
      const updated = await client.conversations.update(id, payload);
      upsertConversation(updated);
      return updated;
    },
    [client, upsertConversation],
  );

  const deleteConversation = React.useCallback(
    async (id: string) => {
      setError(null);
      await client.conversations.delete(id);
      setConversationsState((prev) => prev.filter((item) => item.id !== id));
    },
    [client],
  );

  React.useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  React.useEffect(() => {
    if (!threadId) return;
    if (conversationsState.some((item) => item.threadId === threadId)) return;
    void client.conversations
      .search({ where: { threadId }, limit: 1 })
      .then((result) => {
        const found = result.items?.[0];
        if (found) upsertConversation(found);
      })
      .catch((err) => {
        setError(err);
      });
  }, [client, threadId, conversationsState, upsertConversation]);

  const conversations = React.useMemo(
    () => conversationsState.map((conversation) => toConversation(conversation)),
    [conversationsState],
  );

  return {
    conversations,
    rawConversations: conversationsState,
    isLoading,
    error,
    refreshConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    // Legacy aliases
    refreshThreads: refreshConversations,
    createThread: createConversation,
    updateThreadMetadata: updateConversation,
    deleteThread: deleteConversation,
  };
}
