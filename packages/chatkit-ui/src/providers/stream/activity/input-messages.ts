import type { Client } from '@xpert-ai/xpert-sdk';
import type { Dispatch, SetStateAction } from 'react';
import type { ReadRecovery } from '../connection/read-recovery';
import { normalizeConversationMessagesPage } from '../history/pagination';
import type { ChatKitAIMessage, StateType } from '../types';

/** Insert persisted inputs before their reply without reordering streamed or optimistic messages. */
export function insertInputMessages(
  messages: ChatKitAIMessage[],
  inputs: ChatKitAIMessage[],
): ChatKitAIMessage[] {
  const result = [...messages];
  for (const input of inputs) {
    if (
      input.type !== 'human' ||
      result.some((message) => message.id === input.id)
    )
      continue;
    const child = result.findIndex((message) => message.parentId === input.id);
    if (child >= 0) result.splice(child, 0, input);
  }
  return result.length === messages.length ? messages : result;
}

export async function reconcileInputMessages(options: {
  client: Client<StateType>;
  recovery: ReadRecovery;
  conversationId: string;
  threadId: string;
  signal: AbortSignal;
  isCurrent: () => boolean;
  checked: Set<string>;
  getMessages: () => ChatKitAIMessage[];
  setValues: Dispatch<SetStateAction<StateType>>;
}) {
  const {
    client,
    recovery,
    conversationId,
    threadId,
    signal,
    isCurrent,
    checked,
  } = options;
  const messages = options.getMessages();
  const present = new Set(messages.map((message) => message.id));
  const parents = new Set(
    messages
      .filter((message) => message.type === 'ai')
      .map((message) => message.parentId),
  );
  for (const id of parents) {
    if (!isCurrent()) return;
    if (!id || present.has(id) || checked.has(id)) continue;
    const page = await recovery.read(
      `input:${id}`,
      (readSignal) =>
        client.conversations.searchMessages(
          conversationId,
          {
            // Use the visible thread projection, not executionId (which is null on inputs).
            where: { threadId, id, role: 'human' },
            limit: 1,
            offset: 0,
          },
          { signal: readSignal },
        ),
      signal,
    );
    if (!isCurrent()) return;
    const inputs = normalizeConversationMessagesPage(page).messages;
    options.setValues((previous) => {
      if (!isCurrent()) return previous;
      const next = insertInputMessages(previous.messages, inputs);
      return next === previous.messages
        ? previous
        : { ...previous, messages: next };
    });
    // A parent may itself be an AI row outside the loaded page. Do not walk older history.
    checked.add(id);
  }
}
