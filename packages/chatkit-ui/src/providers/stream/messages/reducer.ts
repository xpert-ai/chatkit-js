import type { Message } from '@langchain/core/messages';
import type { TMessageContentComplex } from '@xpert-ai/chatkit-types';
import type React from 'react';
import { upsertAgentRun } from '../../../lib/agent-runs';
import { appendMessageContent } from '../../../lib/message';
import { createMessageId } from '../../../lib/utils';
import type {
  ChatKitAIMessage,
  ChatKitMessageContentPart,
  StateType,
} from '../types';
import { createMessageFromData } from './metadata';

export function applyOptimisticValues(
  prev: StateType,
  optimistic: Partial<StateType> | ((prev: StateType) => Partial<StateType>),
): StateType {
  const update =
    typeof optimistic === 'function' ? optimistic(prev) : optimistic;
  return { ...prev, ...update };
}

export function mergePreservedMessages(
  messages: ChatKitAIMessage[],
  preservedMessages: ChatKitAIMessage[] | undefined,
  previousMessages: ChatKitAIMessage[],
): ChatKitAIMessage[] {
  const previousById = new Map(
    previousMessages.map((message) => [message.id, message]),
  );
  messages = messages.map((message) => {
    const previous = previousById.get(message.id);
    if (
      !previous ||
      (message.executionId &&
        previous.executionId &&
        message.executionId !== previous.executionId)
    )
      return message;
    const agentRuns = (message.agentRuns ?? []).reduce(
      (runs, incoming) => upsertAgentRun(runs, incoming),
      previous.agentRuns ?? [],
    );
    return {
      ...message,
      createdAt: message.createdAt ?? previous.createdAt,
      updatedAt: message.updatedAt ?? previous.updatedAt,
      status: message.status ?? previous.status,
      executionId: message.executionId ?? previous.executionId,
      ...(agentRuns.length ? { agentRuns } : {}),
    };
  });
  if (!preservedMessages?.length) {
    return messages;
  }

  const nextMessages = [...messages];
  const nextMessageIds = new Set(
    nextMessages
      .map((message) => message.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  for (const preservedMessage of preservedMessages) {
    if (preservedMessage.id && nextMessageIds.has(preservedMessage.id)) {
      continue;
    }

    const previousIndex = preservedMessage.id
      ? previousMessages.findIndex(
          (message) => message.id === preservedMessage.id,
        )
      : -1;
    let insertAt = 0;

    if (previousIndex >= 0) {
      for (let index = previousIndex - 1; index >= 0; index -= 1) {
        const previousId = previousMessages[index]?.id;
        if (!previousId) {
          continue;
        }
        const nextIndex = nextMessages.findIndex(
          (message) => message.id === previousId,
        );
        if (nextIndex >= 0) {
          insertAt = nextIndex + 1;
          break;
        }
      }

      if (insertAt === 0) {
        for (
          let index = previousIndex + 1;
          index < previousMessages.length;
          index += 1
        ) {
          const previousId = previousMessages[index]?.id;
          if (!previousId) {
            continue;
          }
          const nextIndex = nextMessages.findIndex(
            (message) => message.id === previousId,
          );
          if (nextIndex >= 0) {
            insertAt = nextIndex;
            break;
          }
        }
      }
    }

    nextMessages.splice(insertAt, 0, preservedMessage);
    if (preservedMessage.id) {
      nextMessageIds.add(preservedMessage.id);
    }
  }

  return nextMessages;
}

export function isAssistantMessage(message: ChatKitAIMessage | undefined) {
  return (
    message?.type === 'ai' ||
    (typeof message?.type === 'string' &&
      message.type.toLowerCase() === 'assistant')
  );
}

export function findLatestAssistantMessageIndex(messages: ChatKitAIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isAssistantMessage(messages[index])) {
      return index;
    }
  }

  return -1;
}

export function findAssistantMessageIndex(
  messages: ChatKitAIMessage[],
  messageId?: string,
) {
  const matchingIndex = messageId
    ? messages.findIndex(
        (message) => isAssistantMessage(message) && message.id === messageId,
      )
    : -1;
  return matchingIndex >= 0
    ? matchingIndex
    : findLatestAssistantMessageIndex(messages);
}

export function getLatestExecutionIdFromMessages(messages: ChatKitAIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const executionId = messages[index]?.executionId?.trim();
    if (executionId) return executionId;
  }

  return null;
}

export function isLiveThreadRunStatus(
  status: string | undefined | null,
): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return (
    normalized === 'busy' ||
    normalized === 'running' ||
    normalized === 'pausing' ||
    normalized === 'paused' ||
    normalized === 'interrupted'
  );
}

export function getLatestAssistantMessageTarget(messages: ChatKitAIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isAssistantMessage(message)) continue;

    const aiMessageId =
      typeof message?.id === 'string' && message.id.trim()
        ? message.id.trim()
        : undefined;
    const executionId = message?.executionId?.trim() || undefined;

    return {
      ...(aiMessageId ? { aiMessageId } : {}),
      ...(executionId ? { executionId } : {}),
    };
  }

  return {};
}

export function appendMessages(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  nextMessages: ChatKitAIMessage[],
) {
  if (nextMessages.length === 0) return;
  setValues((prev) => ({
    ...prev,
    messages: upsertMessages(prev.messages ?? [], nextMessages),
  }));
}

export function upsertMessages(
  existingMessages: ChatKitAIMessage[],
  nextMessages: ChatKitAIMessage[],
) {
  const messages = [...existingMessages];
  const indexes = new Map<string, number>();

  messages.forEach((message, index) => {
    if (message.id) {
      indexes.set(String(message.id), index);
    }
  });

  for (const message of nextMessages) {
    const id = message.id ? String(message.id) : null;
    if (id && indexes.has(id)) {
      const index = indexes.get(id) as number;
      messages[index] = {
        ...messages[index],
        ...message,
      };
      continue;
    }
    if (id) {
      indexes.set(id, messages.length);
    }
    messages.push(message);
  }

  return messages;
}

export function startFreshAssistantMessageIfNeeded(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  shouldStartFreshAssistant: boolean,
) {
  if (!shouldStartFreshAssistant) {
    return;
  }

  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastMessage = messages[messages.length - 1];
    if (
      isAssistantMessage(lastMessage) &&
      ((typeof lastMessage.content === 'string' &&
        lastMessage.content.length === 0) ||
        lastMessage.content == null)
    ) {
      return prev;
    }

    return {
      ...prev,
      messages: [
        ...messages,
        {
          id: createMessageId(),
          type: 'ai',
          content: '',
        },
      ],
    };
  });
}

export function appendStreamText(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  text: string,
) {
  if (!text) return;
  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findLatestAssistantMessageIndex(messages);
    const last =
      lastAssistantIndex >= 0 ? messages[lastAssistantIndex] : undefined;

    if (last && isAssistantMessage(last) && typeof last.content === 'string') {
      const nextMessages = [...messages];
      nextMessages[lastAssistantIndex] = {
        ...last,
        content: last.content + text,
      };
      return { ...prev, messages: nextMessages };
    }

    const newMessage: ChatKitAIMessage = {
      id: createMessageId(),
      type: 'ai',
      content: text,
    };
    return { ...prev, messages: [...messages, newMessage] };
  });
}

export function appendStreamTextToMessage(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  text: string,
  messageId?: string,
) {
  if (!text) return;
  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findAssistantMessageIndex(messages, messageId);
    if (lastAssistantIndex < 0) {
      const newMessage: ChatKitAIMessage = {
        id: createMessageId(),
        type: 'ai',
        content: text,
      };
      return { ...prev, messages: [newMessage] };
    }

    const last = messages[lastAssistantIndex];
    let nextContent: ChatKitAIMessage['content'];
    if (typeof last.content === 'string') {
      nextContent = last.content + text;
    } else if (Array.isArray(last.content)) {
      nextContent = [
        ...last.content,
        { type: 'text', text } as ChatKitMessageContentPart,
      ];
    } else if (last.content == null) {
      nextContent = text;
    } else {
      nextContent = `${String(last.content)}${text}`;
    }

    const nextMessages = [...messages];
    nextMessages[lastAssistantIndex] = { ...last, content: nextContent };
    return { ...prev, messages: nextMessages };
  });
}

export function updateAssistantMessage(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  updater: (message: Message) => Message,
  messageId?: string,
) {
  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findAssistantMessageIndex(messages, messageId);
    if (lastAssistantIndex < 0) return prev;
    const nextMessages = [...messages];
    nextMessages[lastAssistantIndex] = updater(
      nextMessages[lastAssistantIndex],
    );
    return { ...prev, messages: nextMessages };
  });
}

export function applyMessageData(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  data: unknown,
) {
  if (typeof data === 'string') {
    appendStreamText(setValues, data);
    return;
  }
  if (Array.isArray(data)) {
    const messages = data
      .map((item) => createMessageFromData(item))
      .filter((item): item is Message => Boolean(item));
    appendMessages(setValues, messages);
    return;
  }

  const message = createMessageFromData(data);
  if (message) {
    appendMessages(setValues, [message]);
  }
}

export function appendMessageComponent(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  content: TMessageContentComplex,
  messageId?: string,
) {
  updateAssistantMessage(
    setValues,
    (lastM) => {
      // Deep clone the message to avoid mutation issues with React Strict Mode
      // React Strict Mode calls state updater twice, and appendMessageContent mutates the content array
      const lastMessage = lastM as unknown as Record<string, unknown>;
      const clonedMessage = {
        ...lastMessage,
        content: Array.isArray(lastMessage.content)
          ? (lastMessage.content as Record<string, unknown>[]).map((item) => ({
              ...item,
            }))
          : lastMessage.content,
        reasoning: Array.isArray(lastMessage.reasoning)
          ? (lastMessage.reasoning as Record<string, unknown>[]).map((r) => ({
              ...r,
            }))
          : lastMessage.reasoning,
      };
      appendMessageContent(clonedMessage as any, content);
      return clonedMessage as unknown as Message;
    },
    messageId,
  );
}
