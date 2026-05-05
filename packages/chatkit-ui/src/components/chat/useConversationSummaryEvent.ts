import * as React from 'react';
import type { ParentMessenger } from '../../hooks/useParentMessenger';
import type { ThreadItem } from '../../hooks/useThreads';

const CONVERSATION_SUMMARY_LOG_NAME = 'thread.summary';
const CONVERSATION_SUMMARY_TITLE_FALLBACK_MAX_LENGTH = 80;

export type ConversationSummaryStatus = 'running' | 'completed' | 'failed';

export type ConversationSummary = {
  threadId: string;
  title: string;
  message: string;
  status: ConversationSummaryStatus;
  messageId?: string;
  updatedAt?: string;
};

type ConversationSummarySourceMessage = {
  type: unknown;
  content: unknown;
  id?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type UseConversationSummaryEventArgs = {
  parentMessenger?: Pick<ParentMessenger, 'sendEvent'> | null;
  threadId?: string | null;
  currentThread?: Pick<ThreadItem, 'title' | 'status'> | null;
  currentThreadIsRunning: boolean;
  threadErrorMessage?: string;
  messages: readonly ConversationSummarySourceMessage[];
  fallbackTitle: string;
};

function formatUnknownMessageContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(formatUnknownMessageContent).join('');
  }

  if (!content || typeof content !== 'object') {
    return '';
  }

  const contentWithText = content as { text?: unknown };
  return typeof contentWithText.text === 'string' ? contentWithText.text : '';
}

function getMessagePlainText(message: ConversationSummarySourceMessage): string {
  return formatUnknownMessageContent(message.content).replace(/\s+/g, ' ').trim();
}

function findLatestMessageByType(
  messages: readonly ConversationSummarySourceMessage[],
  types: readonly string[],
): ConversationSummarySourceMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    if (types.includes(String(message.type))) {
      return message;
    }
  }

  return null;
}

function getMessageStringField(
  message: ConversationSummarySourceMessage,
  field: 'id' | 'createdAt' | 'updatedAt',
): string | undefined {
  const value = message[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function truncateSummaryText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildConversationSummary({
  threadId,
  currentThread,
  currentThreadIsRunning,
  threadErrorMessage,
  messages,
  fallbackTitle,
}: Omit<UseConversationSummaryEventArgs, 'parentMessenger'>): ConversationSummary | null {
  const normalizedThreadId = threadId?.trim();
  if (!normalizedThreadId) {
    return null;
  }

  const errorMessage = threadErrorMessage?.trim();
  const assistantMessage = findLatestMessageByType(messages, [
    'assistant',
    'ai',
  ]);
  if (!assistantMessage && !errorMessage) {
    return null;
  }

  const assistantMessageText = assistantMessage
    ? getMessagePlainText(assistantMessage)
    : '';
  const message = errorMessage || assistantMessageText;
  if (!message) {
    return null;
  }

  const latestUserMessage = findLatestMessageByType(messages, [
    'user',
    'human',
  ]);
  const title =
    currentThread?.title?.trim() ||
    (latestUserMessage
      ? truncateSummaryText(
          getMessagePlainText(latestUserMessage),
          CONVERSATION_SUMMARY_TITLE_FALLBACK_MAX_LENGTH,
        )
      : '') ||
    fallbackTitle;
  const status: ConversationSummaryStatus =
    errorMessage || currentThread?.status === 'error'
      ? 'failed'
      : currentThreadIsRunning
        ? 'running'
        : 'completed';

  return {
    threadId: normalizedThreadId,
    title,
    message,
    status,
    ...(assistantMessage && getMessageStringField(assistantMessage, 'id')
      ? { messageId: getMessageStringField(assistantMessage, 'id') }
      : {}),
    ...(assistantMessage && getMessageStringField(assistantMessage, 'updatedAt')
      ? { updatedAt: getMessageStringField(assistantMessage, 'updatedAt') }
      : assistantMessage && getMessageStringField(assistantMessage, 'createdAt')
        ? { updatedAt: getMessageStringField(assistantMessage, 'createdAt') }
        : {}),
  };
}

export function useConversationSummaryEvent({
  parentMessenger,
  threadId,
  currentThread,
  currentThreadIsRunning,
  threadErrorMessage,
  messages,
  fallbackTitle,
}: UseConversationSummaryEventArgs): ConversationSummary | null {
  const summary = React.useMemo(
    () =>
      buildConversationSummary({
        threadId,
        currentThread,
        currentThreadIsRunning,
        threadErrorMessage,
        messages,
        fallbackTitle,
      }),
    [
      currentThread?.status,
      currentThread?.title,
      currentThreadIsRunning,
      fallbackTitle,
      messages,
      threadErrorMessage,
      threadId,
    ],
  );
  const sendParentEvent = parentMessenger?.sendEvent;

  React.useEffect(() => {
    if (!sendParentEvent) {
      return;
    }

    sendParentEvent('public_event', [
      'log',
      {
        name: CONVERSATION_SUMMARY_LOG_NAME,
        data: summary,
      },
    ]);
  }, [sendParentEvent, summary]);

  return summary;
}
