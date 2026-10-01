import type { ChatMessage } from '@xpert-ai/xpert-sdk';
import {
  isHiddenPendingFollowUpMessage,
  mapPersistedPendingFollowUp,
  type PendingFollowUp,
} from '../../../lib/follow-ups';
import { mapChatMessageToUiMessage } from '../messages/metadata';
import type {
  ChatKitAIMessage,
  HistoryMessagePaginationState,
  PersistedChatMessage,
} from '../types';

export const DEFAULT_HISTORY_PAGE_SIZE = 50;

export function createEmptyHistoryMessagePagination(): HistoryMessagePaginationState {
  return {
    conversationId: null,
    threadId: null,
    loadedCount: 0,
    total: 0,
    hasMore: false,
    isLoadingMore: false,
  };
}

export function createConversationMessagesPageQuery(offset: number) {
  return {
    order: { createdAt: 'DESC' as const },
    limit: DEFAULT_HISTORY_PAGE_SIZE,
    offset: Math.max(0, offset),
  };
}

export function parseMessageCreatedAt(message: {
  createdAt?: string;
}): number | null {
  const time = Date.parse(message.createdAt ?? '');
  return Number.isNaN(time) ? null : time;
}

export function sortMessagesByCreatedAt<
  T extends { id?: string; parentId?: string | null; createdAt?: string },
>(items: T[]): T[] {
  const chronological = items
    .map((item, index) => ({
      item,
      index,
      time: parseMessageCreatedAt(item),
    }))
    .sort((a, b) => {
      if (a.time !== null && b.time !== null) {
        if (a.time !== b.time) return a.time - b.time;
        return a.index - b.index;
      }
      if (a.time === null && b.time === null) {
        return a.index - b.index;
      }
      return a.time === null ? 1 : -1;
    })
    .map(({ item }) => item);
  // Tree edges define message order even when persisted timestamps are equal.
  const byId = new Map(
    items.filter((item) => item.id).map((item) => [item.id, item]),
  );
  const visited = new Set<T>();
  const ordered: T[] = [];
  const visit = (item: T) => {
    if (visited.has(item)) return;
    visited.add(item);
    const parent = item.parentId ? byId.get(item.parentId) : undefined;
    if (parent) visit(parent);
    ordered.push(item);
  };
  chronological.forEach(visit);
  return ordered;
}

export function normalizeHistoryTotal(
  total: unknown,
  loadedCount: number,
): number {
  return typeof total === 'number' && Number.isFinite(total) && total >= 0
    ? total
    : loadedCount;
}

export function normalizeConversationMessagesPage(
  response: { items?: ChatMessage[]; total?: number },
  previousLoadedCount = 0,
) {
  const persistedMessages =
    (response.items as PersistedChatMessage[] | undefined) ?? [];
  const pendingFollowUps = persistedMessages
    .filter((message) => isHiddenPendingFollowUpMessage(message))
    .map((message) => mapPersistedPendingFollowUp(message))
    .filter((item): item is PendingFollowUp => Boolean(item));
  const messages = sortMessagesByCreatedAt(
    persistedMessages.filter(
      (message) => !isHiddenPendingFollowUpMessage(message),
    ),
  ).map(mapChatMessageToUiMessage);
  const loadedCount = previousLoadedCount + persistedMessages.length;
  const total = normalizeHistoryTotal(response.total, loadedCount);

  return {
    messages,
    pendingFollowUps,
    loadedCount,
    total,
    hasMore: loadedCount < total,
  };
}

export function mergeHistoryUiMessages(
  existingMessages: ChatKitAIMessage[],
  nextMessages: ChatKitAIMessage[],
): ChatKitAIMessage[] {
  if (nextMessages.length === 0) {
    return existingMessages;
  }

  const messagesById = new Map<string, ChatKitAIMessage>();
  const anonymousMessages: ChatKitAIMessage[] = [];

  for (const message of [...nextMessages, ...existingMessages]) {
    const id = message.id ? String(message.id) : null;
    if (!id) {
      anonymousMessages.push(message);
      continue;
    }
    messagesById.set(id, message);
  }

  return sortMessagesByCreatedAt([
    ...messagesById.values(),
    ...anonymousMessages,
  ]);
}
