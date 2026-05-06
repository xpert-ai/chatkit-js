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

type ConversationSummaryMessageMatch = {
  message: ConversationSummarySourceMessage;
  index: number;
};

export type UseConversationSummaryEventArgs = {
  parentMessenger?: Pick<ParentMessenger, 'sendEvent'> | null;
  threadId?: string | null;
  currentThread?: Pick<ThreadItem, 'title' | 'status'> | null;
  currentThreadIsRunning: boolean;
  threadErrorMessage?: string;
  messages: readonly ConversationSummarySourceMessage[];
  historyMessageLoadVersion?: number;
  fallbackTitle: string;
};

type ConversationSummaryEmissionState = {
  threadId: string | null;
  historyMessageLoadVersion: number;
  baselineSourceKey: string | null;
  publishedSourceKey: string | null;
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

function getMessagePlainText(
  message: ConversationSummarySourceMessage,
): string {
  return formatUnknownMessageContent(message.content)
    .replace(/\s+/g, ' ')
    .trim();
}

function findLatestMessageMatchByType(
  messages: readonly ConversationSummarySourceMessage[],
  types: readonly string[],
): ConversationSummaryMessageMatch | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    if (types.includes(String(message.type))) {
      return { message, index };
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

function normalizeThreadId(threadId?: string | null): string | null {
  const normalized = threadId?.trim();
  return normalized || null;
}

function getConversationSummarySourceKey(
  summary: ConversationSummary | null,
): string | null {
  if (!summary) {
    return null;
  }

  return [
    summary.threadId,
    summary.messageId ?? '',
    summary.updatedAt ?? '',
    summary.message,
  ].join('\u0001');
}

function buildConversationSummary({
  threadId,
  currentThread,
  currentThreadIsRunning,
  threadErrorMessage,
  messages,
  fallbackTitle,
}: Omit<
  UseConversationSummaryEventArgs,
  'parentMessenger'
>): ConversationSummary | null {
  const normalizedThreadId = threadId?.trim();
  if (!normalizedThreadId) {
    return null;
  }

  const errorMessage = threadErrorMessage?.trim();
  const assistantMatch = findLatestMessageMatchByType(messages, [
    'assistant',
    'ai',
  ]);
  const latestUserMatch = findLatestMessageMatchByType(messages, [
    'user',
    'human',
  ]);
  const assistantMessage = assistantMatch?.message;
  const latestUserMessage = latestUserMatch?.message;
  const assistantMessageText = assistantMessage
    ? getMessagePlainText(assistantMessage)
    : '';
  const latestUserMessageText = latestUserMessage
    ? getMessagePlainText(latestUserMessage)
    : '';
  const latestUserIsAfterAssistant = Boolean(
    latestUserMatch &&
    (!assistantMatch || latestUserMatch.index > assistantMatch.index),
  );
  const shouldUseLatestUserMessage = Boolean(
    currentThreadIsRunning &&
    latestUserMatch &&
    latestUserMessageText &&
    (latestUserIsAfterAssistant || !assistantMessageText),
  );
  const summaryMessage =
    shouldUseLatestUserMessage && latestUserMatch
      ? latestUserMatch.message
      : assistantMessageText
        ? assistantMessage
        : undefined;
  if (!summaryMessage && !errorMessage) {
    return null;
  }

  const summaryMessageText = shouldUseLatestUserMessage
    ? latestUserMessageText
    : assistantMessageText;
  const message = errorMessage || summaryMessageText;
  if (!message) {
    return null;
  }

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
    ...(summaryMessage && getMessageStringField(summaryMessage, 'id')
      ? { messageId: getMessageStringField(summaryMessage, 'id') }
      : {}),
    ...(summaryMessage && getMessageStringField(summaryMessage, 'updatedAt')
      ? { updatedAt: getMessageStringField(summaryMessage, 'updatedAt') }
      : summaryMessage && getMessageStringField(summaryMessage, 'createdAt')
        ? { updatedAt: getMessageStringField(summaryMessage, 'createdAt') }
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
  historyMessageLoadVersion = 0,
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
  const emissionStateRef = React.useRef<ConversationSummaryEmissionState>({
    threadId: null,
    historyMessageLoadVersion,
    baselineSourceKey: null,
    publishedSourceKey: null,
  });

  React.useEffect(() => {
    if (!sendParentEvent) {
      return;
    }

    const normalizedThreadId = summary?.threadId ?? normalizeThreadId(threadId);
    const sourceKey = getConversationSummarySourceKey(summary);
    const state = emissionStateRef.current;
    const sendSummary = (data: ConversationSummary | null) => {
      sendParentEvent('public_event', [
        'log',
        {
          name: CONVERSATION_SUMMARY_LOG_NAME,
          data,
        },
      ]);
    };

    if (state.threadId !== normalizedThreadId) {
      emissionStateRef.current = {
        threadId: normalizedThreadId,
        historyMessageLoadVersion,
        baselineSourceKey: sourceKey,
        publishedSourceKey: null,
      };
      sendSummary(null);
      return;
    }

    if (state.historyMessageLoadVersion !== historyMessageLoadVersion) {
      state.historyMessageLoadVersion = historyMessageLoadVersion;
      state.baselineSourceKey = sourceKey;
      state.publishedSourceKey = null;
      sendSummary(null);
      return;
    }

    if (!summary || !sourceKey) {
      state.baselineSourceKey = null;
      state.publishedSourceKey = null;
      sendSummary(null);
      return;
    }

    if (!state.publishedSourceKey && state.baselineSourceKey === sourceKey) {
      return;
    }

    state.publishedSourceKey = sourceKey;
    sendSummary(summary);
  }, [historyMessageLoadVersion, sendParentEvent, summary, threadId]);

  return summary;
}
