import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQueryState } from 'nuqs';
import {
  Client,
  type Checkpoint,
  type Config,
  type StreamMode,
  type ChatMessage,
} from '@xpert-ai/xpert-sdk';
import type { Message } from '@langchain/core/messages';
import { type ToolCall } from '@langchain/core/messages/tool';
import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
  REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION,
  REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION,
  REQUEST_USER_INPUT_RESULT_TYPE,
  REQUEST_USER_INPUT_TOOL_NAME,
  isLangGraphInterruptPayload,
  isClientToolRequest,
  type ChatKitReferenceCompositionMode,
  type ChatKitReference,
  type ClientToolMessageInput,
  type ClientToolRequest,
  type ClientToolResponse,
  type FollowUpBehavior,
  type HITLDecision,
  type HITLResponse,
  type LangGraphInterruptPayload,
  type RequestUserInputAnswer,
  type RequestUserInputToolArgs,
  type RequestUserInputQuestion,
  type RequestUserInputResult,
  type RequestUserInputResultPurpose,
  type TChatRequest,
  type TXpertChatResumeRequest,
  type ChatEventEnvelope,
  type TMessageContentComplex,
  type TMessageContentComponent,
  type TThreadContextUsageEvent,
  type ThreadGoal,
  normalizeRequestLanguage,
} from '@xpert-ai/chatkit-types';
import { appendMessageContent } from '../lib/message';
import {
  createAgentEventContent,
  isMiddlewareAgentRunInfo,
  normalizeAgentRunInfo,
  type AgentRunInfo,
} from '../lib/agent-runs';
import { upsertAgentRunOnLatestMessage } from '../lib/stream-agent-runs';
import {
  normalizeClientSecretResult,
  type ResolvedClientSecret,
} from '../lib/client-secret';
import { createMissingApiConfigurationError } from '../lib/api-config';
import { normalizeRequestContextAndConfig } from '../lib/request-options';
import type { RuntimeCapabilitiesSelection } from '../lib/runtime-capabilities';
import { useParentMessenger } from '../hooks/useParentMessenger';
import type { ParentMessenger } from './ParentMessenger';
import {
  createLangGraphEventState,
  mapLangGraphEventToChatKit,
  type LangGraphEventContext,
  type LangGraphEventState,
} from './langGraphEventMapper';
import { createMessageId } from '../lib/utils';
import {
  applyThreadContextUsageEvent,
  parseThreadContextUsageEvent,
  type ThreadContextUsageByAgentKey,
} from '../lib/thread-context-usage';
import {
  parseThreadGoalClearedEvent,
  parseThreadGoalUpdatedPatchEvent,
  parseThreadGoalUpdatedEvent,
  type ThreadGoalUpdatedPatchEvent,
} from '../lib/thread-goals';
import {
  parseFollowUpConsumedEvent,
  resolveFollowUpConsumedIds,
} from '../lib/follow-up-consumed';
import {
  extractClientToolCalls,
  extractMessageExecutionId,
  extractMessageReferences,
  extractReferenceComposition,
  extractRuntimeCapabilities,
  extractSubmittedInput,
  isMessageMetadataContainer,
  normalizeMessageType,
  normalizeRoleToMessageType,
  type MessageMetadataContainer,
} from '../lib/message-metadata';
import {
  getAutoDrainQueuedFollowUpIds,
  getPendingSteerFollowUpIds,
  buildSteerFollowUpRunInput,
  createPendingFollowUp,
  getNextAutoQueuedFollowUp,
  getQueuedFollowUpGroup,
  isHiddenPendingFollowUpMessage,
  mapPersistedPendingFollowUp,
  mergeQueuedFollowUpGroup,
  movePendingFollowUpBeforeQueuedItems,
  pendingFollowUpToUiMessage,
  toQueuedSendRequest,
  type FollowUpStatus,
  type PendingFollowUp,
} from '../lib/follow-ups';
import {
  resolveTodoListSnapshotFromMessageComponent,
  type TodoListSnapshot,
} from '../lib/todos';
import {
  resolveRuntimeActivityTriggerFromMessageComponent,
  type RuntimeActivitiesState,
  type RuntimeActivityProviderId,
  type RuntimeActivityTrigger,
} from '../lib/runtime-activity';
import {
  buildHITLResumeRunInput,
  useHITLInterrupts,
  type PendingHITLRequest,
} from '../lib/hitl';
import { logRuntimeActivity, useRuntimeActivities } from './runtime-activities';

export {
  getAutoDrainQueuedFollowUpIds,
  buildSteerFollowUpRunInput,
  getPendingSteerFollowUpIds,
  getNextAutoQueuedFollowUp,
  getQueuedFollowUpGroup,
  mergeFollowUpHumanInputs,
  mergeQueuedFollowUpGroup,
} from '../lib/follow-ups';
export type { PendingHITLRequest } from '../lib/hitl';

type ChatKitAIMessage = Message & {
  executionId?: string;
  createdAt?: string;
  updatedAt?: string;
  attachments?: Record<string, unknown>[];
  fileAssets?: Record<string, unknown>[];
  references?: ChatKitReference[];
  submittedInput?: string;
  referenceComposition?: ChatKitReferenceCompositionMode;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  followUpMode?: FollowUpBehavior;
  followUpStatus?: FollowUpStatus;
  targetExecutionId?: string | null;
  visibleAt?: string | null;
  clientToolCalls?: ToolCall[];
  agentRuns?: AgentRunInfo[];
};

type ChatKitMessageContentPart = NonNullable<
  Exclude<ChatKitAIMessage['content'], string>
>[number];

export type StateType = { messages: ChatKitAIMessage[] };

type StreamRunInput = TChatRequest | TXpertChatResumeRequest;

export type HistoryMessagePaginationState = {
  conversationId: string | null;
  loadedCount: number;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
};

export type PendingRequestUserInput = {
  id: string;
  toolCallId?: string;
  params: RequestUserInputToolArgs;
  createdAt: number;
};

export type StreamSubmitOptions = {
  optimisticValues?:
    | Partial<StateType>
    | ((prev: StateType) => Partial<StateType>);
  preserveOptimisticMessages?: boolean;
  context?: Record<string, unknown>;
  config?: Config & Record<string, unknown>;
  checkpoint?: Omit<Checkpoint, 'thread_id'> | null;
  streamMode?: StreamMode | StreamMode[];
  streamSubgraphs?: boolean;
  streamResumable?: boolean;
  threadId?: string;
  newThread?: boolean;
  joinExistingThread?: boolean;
  followUpMode?: FollowUpBehavior;
  onThreadResolved?: (threadId: string) => void | Promise<void>;
};

type ResumeStreamOptions = Pick<
  StreamSubmitOptions,
  'streamMode' | 'streamSubgraphs' | 'streamResumable' | 'context' | 'config'
>;

export function retainResumeStreamOptions(
  options?: StreamSubmitOptions,
): ResumeStreamOptions {
  return {
    streamMode: options?.streamMode,
    streamSubgraphs: options?.streamSubgraphs,
    streamResumable: options?.streamResumable,
    ...(options?.context ? { context: options.context } : {}),
    ...(options?.config ? { config: options.config } : {}),
  };
}

export type StreamContextType = {
  client: Client<StateType>;
  apiUrl: string;
  assistantId: string;
  apiKey: string;
  organizationId?: string;
  threadId: string | null;
  threadGoal: ThreadGoal | null;
  contextUsageByAgentKey: ThreadContextUsageByAgentKey;
  values: StateType;
  messages: ChatKitAIMessage[];
  historyMessageLoadVersion: number;
  historyMessagePagination: HistoryMessagePaginationState;
  todos: TodoListSnapshot | null;
  runtimeActivities: RuntimeActivitiesState;
  pendingFollowUps: PendingFollowUp[];
  pendingRequestUserInput: PendingRequestUserInput | null;
  pendingHITLRequest: PendingHITLRequest | null;
  isLoading: boolean;
  isReady: boolean;
  error: unknown;
  loadThread: (threadId: string) => Promise<void>;
  loadConversationMessages: (recordId: string) => Promise<ChatKitAIMessage[]>;
  loadMoreConversationMessages: () => Promise<ChatKitAIMessage[]>;
  submit: (
    values?: StreamRunInput | null,
    options?: StreamSubmitOptions,
  ) => Promise<void>;
  stop: () => void;
  reset: (
    newThreadId?: string | null,
    initialMessages?: ChatKitAIMessage[],
    options?: { suppressThreadChange?: boolean },
  ) => void;
  removePendingFollowUp: (id: string) => void;
  canSendPendingFollowUpNow: (id: string) => boolean;
  sendPendingFollowUpNow: (id: string) => Promise<void>;
  promotePendingFollowUpToSteer: (id: string) => Promise<void>;
  submitRequestUserInput: (answers: RequestUserInputAnswer[]) => void;
  submitHITLDecision: (decisions: HITLDecision[]) => void;
  stopRuntimeActivityItem: (
    providerId: RuntimeActivityProviderId,
    itemId: string,
  ) => Promise<void>;
  setThreadId: (threadId: string | null) => void;
};

const StreamContext = createContext<StreamContextType | undefined>(undefined);

const defaultApiUrl =
  (import.meta.env.VITE_XPERTAI_API_URL as string | undefined) ??
  'https://api.xpertai.cn/api/ai';

const DEFAULT_HISTORY_PAGE_SIZE = 50;

function createEmptyHistoryMessagePagination(): HistoryMessagePaginationState {
  return {
    conversationId: null,
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

export function createLanguageHeaders(
  locale?: string | null,
): Record<string, string> | undefined {
  const language = normalizeRequestLanguage(locale);
  return language
    ? {
        Language: language,
        'Accept-Language': language,
      }
    : undefined;
}

function createAbortError(message: string): Error | DOMException {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }

  return new Error(message);
}

function isAbortError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function withClientSecretHeaders(
  headers: HeadersInit | undefined,
  clientSecret: ResolvedClientSecret,
): Headers {
  const nextHeaders = new Headers(headers);
  if (clientSecret.secret) {
    nextHeaders.set('Authorization', `Bearer ${clientSecret.secret}`);
    nextHeaders.set('x-api-key', clientSecret.secret);
  } else {
    nextHeaders.delete('Authorization');
    nextHeaders.delete('x-api-key');
  }

  if (clientSecret.organizationId) {
    nextHeaders.set('organization-id', clientSecret.organizationId);
  } else {
    nextHeaders.delete('organization-id');
  }

  return nextHeaders;
}

type CreateFetchWithClientSecretRefreshOptions = {
  fetchFn?: typeof fetch;
  getCurrentClientSecret: () => ResolvedClientSecret;
  refreshClientSecret: () => Promise<ResolvedClientSecret>;
  onRefreshError?: (error: unknown) => void;
};

export function createFetchWithClientSecretRefresh({
  fetchFn = fetch,
  getCurrentClientSecret,
  refreshClientSecret,
  onRefreshError,
}: CreateFetchWithClientSecretRefreshOptions): typeof fetch {
  return async (input, init) => {
    const requestWithSecret = (clientSecret: ResolvedClientSecret) => {
      return fetchFn(input, {
        ...init,
        headers: withClientSecretHeaders(init?.headers, clientSecret),
      });
    };

    const response = await requestWithSecret(getCurrentClientSecret());
    if (response.status !== 401) {
      return response;
    }

    try {
      const refreshedClientSecret = await refreshClientSecret();
      return await requestWithSecret(refreshedClientSecret);
    } catch (refreshError) {
      onRefreshError?.(refreshError);
      return response;
    }
  };
}

function applyOptimisticValues(
  prev: StateType,
  optimistic: Partial<StateType> | ((prev: StateType) => Partial<StateType>),
): StateType {
  const update =
    typeof optimistic === 'function' ? optimistic(prev) : optimistic;
  return { ...prev, ...update };
}

function mergePreservedMessages(
  messages: ChatKitAIMessage[],
  preservedMessages: ChatKitAIMessage[] | undefined,
  previousMessages: ChatKitAIMessage[],
): ChatKitAIMessage[] {
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

function parseEventData(raw: string): ChatEventEnvelope | null {
  if (typeof raw === 'string') {
    if (!raw || raw.startsWith(':')) return null;
    try {
      return JSON.parse(raw) as ChatEventEnvelope;
    } catch {
      return raw as unknown as ChatEventEnvelope;
    }
  }
  return raw as ChatEventEnvelope;
}

type StreamChunk = { id?: string; event: string; data: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringifyUnknown(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getStreamEventErrorMessage(
  eventType: ChatMessageEventTypeEnum,
  data: unknown,
): string | undefined {
  const record = isRecord(data) ? data : null;

  if (
    eventType === ChatMessageEventTypeEnum.ON_ERROR ||
    eventType === ChatMessageEventTypeEnum.ON_TOOL_ERROR ||
    eventType === ChatMessageEventTypeEnum.ON_RETRIEVER_ERROR
  ) {
    return (
      stringifyUnknown(record?.error) ??
      stringifyUnknown(record?.message) ??
      stringifyUnknown(data)
    )?.trim();
  }

  if (eventType !== ChatMessageEventTypeEnum.ON_CONVERSATION_END) {
    return undefined;
  }

  const status =
    typeof record?.status === 'string' ? record.status.toLowerCase() : '';
  if (status !== 'error' && record?.error == null) {
    return undefined;
  }

  return (
    stringifyUnknown(record?.error) ??
    stringifyUnknown(record?.message) ??
    stringifyUnknown(data)
  )?.trim();
}

type PersistedChatMessage = ChatMessage &
  MessageMetadataContainer & {
    attachments?: unknown;
    fileAssets?: unknown;
    followUpMode?: FollowUpBehavior;
    followUpStatus?: FollowUpStatus;
    targetExecutionId?: string | null;
    visibleAt?: string | null;
    thirdPartyMessage?: unknown;
  };

function normalizeThreadIdentifier(threadId?: string | null): string | null {
  const normalized = typeof threadId === 'string' ? threadId.trim() : '';
  return normalized ? normalized : null;
}

function normalizeMessageFiles(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const files = value.filter(isRecord).map((file) => {
    const originalName =
      typeof file.originalName === 'string'
        ? file.originalName
        : typeof file.name === 'string'
          ? file.name
          : undefined;
    const mimeType =
      typeof file.mimeType === 'string'
        ? file.mimeType
        : typeof file.mimetype === 'string'
          ? file.mimetype
          : undefined;

    return {
      ...file,
      ...(originalName ? { originalName } : {}),
      ...(mimeType ? { mimeType } : {}),
    };
  });

  return files.length > 0 ? files : undefined;
}

function getConversationThreadId(conversation: unknown): string | null {
  if (!isRecord(conversation)) return null;

  const threadId = conversation.threadId ?? conversation.thread_id;
  return typeof threadId === 'string'
    ? normalizeThreadIdentifier(threadId)
    : null;
}

function isResumeRunInput(
  input?: StreamRunInput | null,
): input is TXpertChatResumeRequest {
  return Boolean(
    input &&
    typeof input === 'object' &&
    'action' in input &&
    input.action === 'resume',
  );
}

export function shouldBroadcastThreadChange({
  threadId,
  hasObservedThreadSelection,
}: {
  threadId?: string | null;
  hasObservedThreadSelection: boolean;
}): boolean {
  const currentThreadId = normalizeThreadIdentifier(threadId);
  return hasObservedThreadSelection || currentThreadId !== null;
}

function mapChatMessageToUiMessage(
  message: PersistedChatMessage,
): ChatKitAIMessage {
  const references = extractMessageReferences(message);
  const content = message.content ?? '';
  const type = normalizeRoleToMessageType(
    typeof message.role === 'string' ? message.role : undefined,
  );
  const submittedInput =
    extractSubmittedInput(message) ??
    (type === 'human' && typeof content === 'string' ? content : undefined);
  const referenceComposition = extractReferenceComposition(message);
  const runtimeCapabilities = extractRuntimeCapabilities(message);
  const attachments = normalizeMessageFiles(message.attachments);
  const fileAssets = normalizeMessageFiles(message.fileAssets);

  return {
    id: message.id ?? createMessageId(),
    type,
    content,
    ...(message.reasoning ? { reasoning: message.reasoning as any } : {}),
    ...(message.executionId ? { executionId: message.executionId } : {}),
    ...(message.createdAt ? { createdAt: message.createdAt } : {}),
    ...(message.updatedAt ? { updatedAt: message.updatedAt } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(attachments ? { attachments } : {}),
    ...(fileAssets ? { fileAssets } : {}),
    ...(submittedInput !== undefined ? { submittedInput } : {}),
    ...(referenceComposition ? { referenceComposition } : {}),
    ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
    ...(message.followUpMode ? { followUpMode: message.followUpMode } : {}),
    ...(message.followUpStatus
      ? { followUpStatus: message.followUpStatus }
      : {}),
    ...(message.targetExecutionId !== undefined
      ? { targetExecutionId: message.targetExecutionId }
      : {}),
    ...(message.visibleAt !== undefined
      ? { visibleAt: message.visibleAt }
      : {}),
  } as ChatKitAIMessage;
}

function parseMessageCreatedAt(message: { createdAt?: string }): number | null {
  const time = Date.parse(message.createdAt ?? '');
  return Number.isNaN(time) ? null : time;
}

function sortMessagesByCreatedAt<T extends { createdAt?: string }>(
  items: T[],
): T[] {
  return items
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
}

function normalizeHistoryTotal(total: unknown, loadedCount: number): number {
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

export function mergePendingFollowUps(
  existingItems: PendingFollowUp[],
  nextItems: PendingFollowUp[],
): PendingFollowUp[] {
  if (nextItems.length === 0) {
    return existingItems;
  }

  const itemsById = new Map<string, PendingFollowUp>();
  for (const item of existingItems) {
    itemsById.set(item.id, item);
  }
  for (const item of nextItems) {
    const existingItem = itemsById.get(item.id);
    if (existingItem?.queuedFromSteer) {
      itemsById.set(item.id, {
        ...item,
        request: {
          ...item.request,
          ...(existingItem.request.executionId
            ? { executionId: existingItem.request.executionId }
            : {}),
          followUpMode: item.mode,
        },
        targetExecutionId:
          existingItem.targetExecutionId ?? item.targetExecutionId,
        queuedFromSteer: true,
      });
      continue;
    }

    itemsById.set(item.id, item);
  }

  return [...itemsById.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function isAssistantMessage(message: ChatKitAIMessage | undefined) {
  return (
    message?.type === 'ai' ||
    (typeof message?.type === 'string' &&
      message.type.toLowerCase() === 'assistant')
  );
}

function findLatestAssistantMessageIndex(messages: ChatKitAIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isAssistantMessage(messages[index])) {
      return index;
    }
  }

  return -1;
}

function getLatestExecutionIdFromMessages(messages: ChatKitAIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const executionId = messages[index]?.executionId?.trim();
    if (executionId) return executionId;
  }

  return null;
}

function getLatestAssistantMessageTarget(messages: ChatKitAIMessage[]) {
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

function appendMessages(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  nextMessages: ChatKitAIMessage[],
) {
  if (nextMessages.length === 0) return;
  setValues((prev) => ({
    ...prev,
    messages: upsertMessages(prev.messages ?? [], nextMessages),
  }));
}

function upsertMessages(
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

function startFreshAssistantMessageIfNeeded(
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

function appendStreamText(
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

function appendStreamTextToLatest(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  text: string,
) {
  if (!text) return;
  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findLatestAssistantMessageIndex(messages);
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

function createMessageFromData(data: unknown): ChatKitAIMessage | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    return { id: createMessageId(), type: 'ai', content: data };
  }
  if (!isMessageMetadataContainer(data)) return null;

  const raw = data;
  const content: ChatKitAIMessage['content'] = (() => {
    if ('content' in raw) {
      const rawContent = (raw as { content?: Message['content'] }).content;
      if (typeof rawContent === 'string' || Array.isArray(rawContent)) {
        return rawContent;
      }
      if (rawContent == null) {
        return '';
      }
    }

    if ('text' in raw) {
      const textContent = (raw as { text?: Message['content'] }).text;
      if (typeof textContent === 'string' || Array.isArray(textContent)) {
        return textContent;
      }
      if (textContent == null) {
        return '';
      }
    }

    return [raw as unknown as ChatKitMessageContentPart];
  })();
  const type =
    normalizeMessageType(raw.type) ?? normalizeMessageType(raw.role) ?? 'ai';
  const id = typeof raw.id === 'string' ? raw.id : createMessageId();
  const executionId =
    typeof raw.executionId === 'string' ? raw.executionId : undefined;
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : undefined;
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined;
  const references = extractMessageReferences(raw);
  const submittedInput =
    extractSubmittedInput(raw) ??
    (type === 'human' && typeof content === 'string' ? content : undefined);
  const referenceComposition = extractReferenceComposition(raw);
  const runtimeCapabilities = extractRuntimeCapabilities(raw);
  const toolCalls = extractClientToolCalls(raw);
  const attachments = normalizeMessageFiles((raw as { attachments?: unknown }).attachments);
  const fileAssets = normalizeMessageFiles((raw as { fileAssets?: unknown }).fileAssets);
  const rawAgentRuns = (raw as { agentRuns?: unknown }).agentRuns;
  const agentRuns = Array.isArray(rawAgentRuns)
    ? rawAgentRuns
        .map((item) => normalizeAgentRunInfo(item))
        .filter((item): item is AgentRunInfo => Boolean(item))
    : [];

  return {
    id,
    type,
    content,
    executionId,
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(toolCalls ? { clientToolCalls: toolCalls } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(attachments ? { attachments } : {}),
    ...(fileAssets ? { fileAssets } : {}),
    ...(submittedInput !== undefined ? { submittedInput } : {}),
    ...(referenceComposition ? { referenceComposition } : {}),
    ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
    ...(agentRuns.length > 0 ? { agentRuns } : {}),
  };
}

function extractMessageMeta(raw: MessageMetadataContainer) {
  const meta: {
    id?: string;
    type?: ChatKitAIMessage['type'];
    content?: ChatKitAIMessage['content'];
    references?: ChatKitReference[];
    submittedInput?: string;
    referenceComposition?: ChatKitReferenceCompositionMode;
    runtimeCapabilities?: RuntimeCapabilitiesSelection;
    attachments?: Record<string, unknown>[];
    fileAssets?: Record<string, unknown>[];
    clientToolCalls?: ToolCall[];
  } = {};

  if (typeof raw.id === 'string') meta.id = raw.id;
  meta.type = normalizeMessageType(raw.type ?? raw.role);
  if ('content' in raw) {
    meta.content = (raw as { content?: Message['content'] }).content;
  }
  const references = extractMessageReferences(raw);
  const submittedInput = extractSubmittedInput(raw);
  const referenceComposition = extractReferenceComposition(raw);
  const runtimeCapabilities = extractRuntimeCapabilities(raw);
  const attachments = normalizeMessageFiles((raw as { attachments?: unknown }).attachments);
  const fileAssets = normalizeMessageFiles((raw as { fileAssets?: unknown }).fileAssets);
  const clientToolCalls = extractClientToolCalls(raw);
  if (references.length > 0) {
    meta.references = references;
  }
  if (submittedInput !== undefined) {
    meta.submittedInput = submittedInput;
  }
  if (referenceComposition) {
    meta.referenceComposition = referenceComposition;
  }
  if (runtimeCapabilities) {
    meta.runtimeCapabilities = runtimeCapabilities;
  }
  if (attachments) {
    meta.attachments = attachments;
  }
  if (fileAssets) {
    meta.fileAssets = fileAssets;
  }
  if (clientToolCalls) {
    meta.clientToolCalls = clientToolCalls;
  }

  return meta;
}

function updateLatestMessage(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  updater: (message: Message) => Message,
) {
  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findLatestAssistantMessageIndex(messages);
    if (lastAssistantIndex < 0) return prev;
    const nextMessages = [...messages];
    nextMessages[lastAssistantIndex] = updater(
      nextMessages[lastAssistantIndex],
    );
    return { ...prev, messages: nextMessages };
  });
}

function applyMessageData(
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

/**
 * Append a complex message content (e.g., with components) into the latest message
 */
function appendMessageComponent(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  content: TMessageContentComplex,
) {
  updateLatestMessage(setValues, (lastM) => {
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
  });
}

function normalizeClientToolRequest(value: unknown): ClientToolRequest | null {
  return isClientToolRequest(value) ? value : null;
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeRequestUserInputParams(
  value: unknown,
): RequestUserInputToolArgs | null {
  if (!value || typeof value !== 'object') return null;

  const questions = (value as { questions?: unknown }).questions;
  if (
    !Array.isArray(questions) ||
    questions.length < 1 ||
    questions.length > 3
  ) {
    return null;
  }

  const normalizedQuestions: RequestUserInputQuestion[] = [];
  for (const question of questions) {
    if (!question || typeof question !== 'object') return null;

    const rawQuestion = question as {
      id?: unknown;
      header?: unknown;
      question?: unknown;
      options?: unknown;
    };
    const id = readTrimmedString(rawQuestion.id);
    const header = readTrimmedString(rawQuestion.header);
    const questionText = readTrimmedString(rawQuestion.question);
    if (!id || !header || !questionText) return null;

    const options = rawQuestion.options;
    if (!Array.isArray(options) || options.length < 2 || options.length > 3) {
      return null;
    }

    const normalizedOptions = options.map((option) => {
      if (!option || typeof option !== 'object') return null;
      const rawOption = option as {
        label?: unknown;
        description?: unknown;
      };
      const label = readTrimmedString(rawOption.label);
      if (!label || typeof rawOption.description !== 'string') return null;

      return {
        label,
        description: rawOption.description.trim(),
      };
    });

    if (normalizedOptions.some((option) => option === null)) return null;

    normalizedQuestions.push({
      id,
      header,
      question: questionText,
      options: normalizedOptions as RequestUserInputQuestion['options'],
    });
  }

  return { questions: normalizedQuestions };
}

export function normalizeRequestUserInputToolCall(
  call: ToolCall,
): RequestUserInputToolArgs | null {
  if (call.name !== REQUEST_USER_INPUT_TOOL_NAME) {
    return null;
  }

  return normalizeRequestUserInputParams(call.args);
}

export function getRequestUserInputResultPurpose(
  params: RequestUserInputToolArgs,
): RequestUserInputResultPurpose {
  const questions = params.questions;

  if (questions.length === 1 && questions[0]?.id === 'implement_plan') {
    return REQUEST_USER_INPUT_RESULT_PURPOSE_IMPLEMENTATION_CONFIRMATION;
  }

  return REQUEST_USER_INPUT_RESULT_PURPOSE_PLAN_CLARIFICATION;
}

function collectClientToolRequests(payload: unknown): ClientToolRequest[] {
  if (!isLangGraphInterruptPayload(payload)) return [];

  const requests: ClientToolRequest[] = [];
  const interruptPayload: LangGraphInterruptPayload = payload;
  for (const task of interruptPayload.tasks) {
    for (const interrupt of task.interrupts) {
      const request = normalizeClientToolRequest(interrupt.value);
      if (request) requests.push(request);
    }
  }

  return requests;
}

function getToolCallIdentity(call: ToolCall): string {
  return typeof call.id === 'string' && call.id.trim()
    ? call.id
    : `${call.name}:${JSON.stringify(call.args ?? {})}`;
}

function mergeClientToolCalls(
  existing: unknown,
  incoming: ToolCall[],
): ToolCall[] {
  const calls = Array.isArray(existing) ? ([...existing] as ToolCall[]) : [];
  const seen = new Set(calls.map(getToolCallIdentity));

  for (const call of incoming) {
    const key = getToolCallIdentity(call);
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push(call);
  }

  return calls;
}

function collectClientToolCalls(payload: unknown): ToolCall[] {
  return collectClientToolRequests(payload).flatMap(
    (request) => request.clientToolCalls ?? [],
  );
}

function rememberClientToolCalls(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  calls: ToolCall[],
) {
  if (calls.length === 0) return;

  setValues((prev) => {
    const messages = prev.messages ?? [];
    const lastAssistantIndex = findLatestAssistantMessageIndex(messages);

    if (lastAssistantIndex < 0) {
      return {
        ...prev,
        messages: [
          ...messages,
          {
            id: createMessageId(),
            type: 'ai',
            content: '',
            clientToolCalls: calls,
          } as ChatKitAIMessage,
        ],
      };
    }

    const nextMessages = [...messages];
    const lastAssistantMessage = nextMessages[lastAssistantIndex] as
      | (ChatKitAIMessage & { clientToolCalls?: ToolCall[] })
      | undefined;

    if (!lastAssistantMessage) return prev;

    nextMessages[lastAssistantIndex] = {
      ...lastAssistantMessage,
      clientToolCalls: mergeClientToolCalls(
        lastAssistantMessage.clientToolCalls,
        calls,
      ),
    } as ChatKitAIMessage;

    return { ...prev, messages: nextMessages };
  });
}

/**
 * Normalize host-provided client tool results at the resume protocol boundary.
 */
export function normalizeToolMessagesResponse(
  response: unknown,
): ClientToolMessageInput | null {
  if (!response) return null;
  if (typeof response === 'object' && response !== null) {
    const raw = response as ClientToolMessageInput;
    return {
      tool_call_id: raw.tool_call_id,
      name: raw.name,
      content: raw.content,
      status: raw.status,
      artifact: raw.artifact,
    };
  }
  return null;
}

export async function resolveClientToolCallResponse(
  call: ToolCall,
  {
    isParentAvailable,
    sendCommand,
    waitForRequestUserInput,
  }: {
    isParentAvailable: boolean;
    sendCommand: ParentMessenger['sendCommand'];
    waitForRequestUserInput: (
      call: ToolCall,
      params: RequestUserInputToolArgs,
    ) => Promise<ClientToolMessageInput>;
  },
): Promise<unknown | null> {
  const requestUserInputParams = normalizeRequestUserInputToolCall(call);
  if (requestUserInputParams) {
    return waitForRequestUserInput(call, requestUserInputParams);
  }

  if (!isParentAvailable) {
    return null;
  }

  return sendCommand('onClientToolCall', {
    name: call.name,
    params: call.args,
    id: call.id,
  });
}

/**
 * Process each stream event chunk
 */
export function applyStreamEvent(
  chunk: StreamChunk,
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  setError: React.Dispatch<React.SetStateAction<unknown>>,
  sendEvent: ParentMessenger['sendEvent'],
  interrupts: unknown[],
  langGraphEventState: LangGraphEventState,
  eventContext?: LangGraphEventContext,
  onExecutionId?: (executionId: string | undefined) => void,
  onThreadContextUsage?: (event: TThreadContextUsageEvent) => void,
  onFollowUpConsumed?: (
    event: ReturnType<typeof parseFollowUpConsumedEvent>,
  ) => void,
  consumeFreshAssistantSplit?: () => boolean,
  getCurrentTodos?: () => TodoListSnapshot | null,
  onTodosChange?: (snapshot: TodoListSnapshot | null) => void,
  onRuntimeActivityTrigger?: (trigger: RuntimeActivityTrigger) => void,
  onThreadGoalUpdated?: (goal: ThreadGoal) => void,
  onThreadGoalCleared?: (threadId: string) => void,
  onThreadGoalPatched?: (event: ThreadGoalUpdatedPatchEvent) => void,
  preservedMessages?: ChatKitAIMessage[],
) {
  const parsed = parseEventData(chunk.data);
  if (parsed == null) return;

  if (chunk.event === 'error') {
    const message =
      typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    setError(new Error(message));
    return;
  }

  if (isMessageMetadataContainer(parsed) && Array.isArray(parsed.messages)) {
    const normalizedMessages = parsed.messages
      .map((item) => createMessageFromData(item))
      .filter((item): item is ChatKitAIMessage => Boolean(item));
    setValues((prev) => ({
      ...prev,
      messages: mergePreservedMessages(
        normalizedMessages,
        preservedMessages,
        prev.messages ?? [],
      ),
    }));
    return;
  }

  if (typeof parsed === 'string') {
    const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
    startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
    appendStreamTextToLatest(setValues, parsed);
    return;
  }

  if (Array.isArray(parsed)) {
    const messages = parsed
      .map((item) => createMessageFromData(item))
      .filter((item): item is Message => Boolean(item));
    appendMessages(setValues, messages);
    return;
  }

  if (typeof parsed !== 'object' || parsed == null) return;

  const payload = parsed as ChatEventEnvelope<TMessageContentComponent<any>>;

  const payloadType: ChatMessageTypeEnum = payload.type;

  if (payloadType === ChatMessageTypeEnum.MESSAGE) {
    if (typeof payload.data === 'string') {
      const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
      startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
      appendStreamTextToLatest(setValues, payload.data);
      return;
    }

    const message = payload.data;
    if (message.type === 'component') {
      const runtimeActivityTrigger =
        resolveRuntimeActivityTriggerFromMessageComponent(message);
      if (runtimeActivityTrigger) {
        onRuntimeActivityTrigger?.({
          ...runtimeActivityTrigger,
          threadId: eventContext?.threadId ?? null,
        });
      }

      const todoResolution = resolveTodoListSnapshotFromMessageComponent(
        message,
        getCurrentTodos?.() ?? null,
      );
      if (todoResolution.matched) {
        onTodosChange?.(todoResolution.snapshot);
        return;
      }
      sendEvent('public_event', ['log', { ...message, name: 'component' }]);
    }
    const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
    startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
    appendMessageComponent(setValues, message);
    return;
  }

  if (payloadType === ChatMessageTypeEnum.EVENT) {
    const eventType = (
      typeof payload.event === 'string' ? payload.event.toLowerCase() : ''
    ) as ChatMessageEventTypeEnum;
    const eventPayloadData: unknown = payload.data;
    const eventData = isMessageMetadataContainer(eventPayloadData)
      ? eventPayloadData
      : null;
    const meta = eventData ? extractMessageMeta(eventData) : {};
    const executionId = eventData
      ? extractMessageExecutionId(eventData)
      : undefined;

    mapLangGraphEventToChatKit({
      eventType,
      data: eventPayloadData,
      tags: payload.tags,
      messageType: typeof meta.type === 'string' ? meta.type : undefined,
      executionId,
      sendEvent,
      state: langGraphEventState,
      context: eventContext,
    });

    const eventErrorMessage = getStreamEventErrorMessage(
      eventType,
      eventPayloadData,
    );
    if (eventErrorMessage) {
      setError(new Error(eventErrorMessage));
    }

    switch (eventType) {
      case ChatMessageEventTypeEnum.ON_CONVERSATION_START:
      case ChatMessageEventTypeEnum.ON_CONVERSATION_END: {
        if (eventData && Array.isArray(eventData.messages)) {
          const normalizedMessages = eventData.messages
            .map((item) => createMessageFromData(item))
            .filter((item): item is ChatKitAIMessage => Boolean(item));
          setValues((prev) => ({
            ...prev,
            messages: mergePreservedMessages(
              normalizedMessages,
              preservedMessages,
              prev.messages ?? [],
            ),
          }));
        }
        break;
      }
      case ChatMessageEventTypeEnum.ON_AGENT_START:
      case ChatMessageEventTypeEnum.ON_AGENT_END: {
        const agentRun = normalizeAgentRunInfo(eventPayloadData, eventType);
        if (agentRun && !isMiddlewareAgentRunInfo(agentRun)) {
          upsertAgentRunOnLatestMessage(
            setValues,
            agentRun,
            findLatestAssistantMessageIndex,
            (run) =>
              ({
                id: createMessageId(),
                type: 'ai',
                content: '',
                agentRuns: [run],
              }) as ChatKitAIMessage,
          );
        }
        break;
      }
      case ChatMessageEventTypeEnum.ON_MESSAGE_START: {
        if (executionId) {
          onExecutionId?.(executionId);
        }
        const message: ChatKitAIMessage = {
          id: meta.id ?? createMessageId(),
          type: meta.type ?? 'ai',
          content: meta.content ?? '',
          executionId,
          ...(meta.references ? { references: meta.references } : {}),
          ...(meta.attachments ? { attachments: meta.attachments } : {}),
          ...(meta.fileAssets ? { fileAssets: meta.fileAssets } : {}),
          ...(meta.submittedInput !== undefined
            ? { submittedInput: meta.submittedInput }
            : {}),
          ...(meta.referenceComposition
            ? { referenceComposition: meta.referenceComposition }
            : {}),
          ...(meta.runtimeCapabilities
            ? { runtimeCapabilities: meta.runtimeCapabilities }
            : {}),
          ...(meta.clientToolCalls
            ? { clientToolCalls: meta.clientToolCalls }
            : {}),
        };
        setValues((prev) => {
          const messages = prev.messages ?? [];
          const shouldStartFreshAssistant =
            consumeFreshAssistantSplit?.() ?? false;
          const lastAssistantIndex = findLatestAssistantMessageIndex(messages);
          const last =
            lastAssistantIndex >= 0 ? messages[lastAssistantIndex] : undefined;
          if (!shouldStartFreshAssistant && last && isAssistantMessage(last)) {
            if (executionId && last.executionId === executionId) {
              const nextMessages = [...messages];
              const nextLast: ChatKitAIMessage = {
                ...last,
                executionId,
                ...(meta.id ? { id: meta.id } : {}),
                ...(meta.type ? { type: meta.type } : {}),
                ...(meta.references ? { references: meta.references } : {}),
                ...(meta.attachments ? { attachments: meta.attachments } : {}),
                ...(meta.fileAssets ? { fileAssets: meta.fileAssets } : {}),
                ...(meta.submittedInput !== undefined
                  ? { submittedInput: meta.submittedInput }
                  : {}),
                ...(meta.referenceComposition
                  ? { referenceComposition: meta.referenceComposition }
                  : {}),
                ...(meta.runtimeCapabilities
                  ? { runtimeCapabilities: meta.runtimeCapabilities }
                  : {}),
                ...(meta.clientToolCalls
                  ? { clientToolCalls: meta.clientToolCalls }
                  : {}),
              };
              if (
                meta.content !== undefined &&
                (last.content == null ||
                  (typeof last.content === 'string' &&
                    last.content.length === 0))
              ) {
                nextLast.content = meta.content;
              }
              nextMessages[lastAssistantIndex] = nextLast;
              return { ...prev, messages: nextMessages };
            }
            if (typeof last.content === 'string' && last.content.length === 0) {
              const nextMessages = [...messages];
              nextMessages[lastAssistantIndex] = {
                ...message,
                ...(last.agentRuns ? { agentRuns: last.agentRuns } : {}),
              };
              return { ...prev, messages: nextMessages };
            }
          }
          return { ...prev, messages: [...messages, message] };
        });
        break;
      }
      case ChatMessageEventTypeEnum.ON_MESSAGE_END: {
        if (
          meta.content === undefined &&
          meta.id === undefined &&
          meta.type === undefined &&
          !meta.runtimeCapabilities
        ) {
          break;
        }
        updateLatestMessage(setValues, (message) => {
          return {
            ...(message as ChatKitAIMessage),
            ...(meta.id ? { id: meta.id } : {}),
            ...(meta.type ? { type: meta.type } : {}),
            ...(meta.content !== undefined ? { content: meta.content } : {}),
            ...(meta.references ? { references: meta.references } : {}),
            ...(meta.submittedInput !== undefined
              ? { submittedInput: meta.submittedInput }
              : {}),
            ...(meta.referenceComposition
              ? { referenceComposition: meta.referenceComposition }
              : {}),
            ...(meta.runtimeCapabilities
              ? { runtimeCapabilities: meta.runtimeCapabilities }
              : {}),
            ...(meta.clientToolCalls
              ? { clientToolCalls: meta.clientToolCalls }
              : {}),
          };
        });
        break;
      }
      case ChatMessageEventTypeEnum.ON_INTERRUPT: {
        interrupts.push(payload.data);
        rememberClientToolCalls(
          setValues,
          collectClientToolCalls(payload.data),
        );
        break;
      }
      case ChatMessageEventTypeEnum.ON_CLIENT_EFFECT: {
        const toolCall = payload.data as unknown as ToolCall;
        sendEvent('public_event', [
          'effect',
          { name: toolCall.name, data: toolCall.args },
        ]);
        break;
      }
      case ChatMessageEventTypeEnum.ON_CHAT_EVENT: {
        const contextUsageEvent = parseThreadContextUsageEvent(payload.data);
        if (contextUsageEvent) {
          onThreadContextUsage?.(contextUsageEvent);
          break;
        }

        const goalUpdatedEvent = parseThreadGoalUpdatedEvent(payload.data);
        if (goalUpdatedEvent) {
          onThreadGoalUpdated?.(goalUpdatedEvent.goal);
          break;
        }

        const goalPatchEvent = parseThreadGoalUpdatedPatchEvent(payload.data);
        if (goalPatchEvent) {
          onThreadGoalPatched?.(goalPatchEvent);
          break;
        }

        const goalClearedEvent = parseThreadGoalClearedEvent(payload.data);
        if (goalClearedEvent) {
          onThreadGoalCleared?.(goalClearedEvent.threadId);
          break;
        }

        const followUpConsumedEvent = parseFollowUpConsumedEvent(payload.data);
        if (followUpConsumedEvent) {
          onFollowUpConsumed?.(followUpConsumedEvent);
          break;
        }

        const agentEvent = createAgentEventContent(payload.data);
        if (agentEvent) {
          const shouldStartFreshAssistant =
            consumeFreshAssistantSplit?.() ?? false;
          startFreshAssistantMessageIfNeeded(
            setValues,
            shouldStartFreshAssistant,
          );
          appendMessageComponent(setValues, agentEvent);
        }
        break;
      }
      default:
        break;
    }
    return;
  }

  if ('data' in payload) {
    const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
    startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
    applyMessageData(setValues, payload.data);
    return;
  }

  const fallbackMessage = createMessageFromData(parsed);
  if (fallbackMessage) {
    appendMessages(setValues, [fallbackMessage]);
  }
}

const StreamSession = ({
  children,
  apiKey,
  organizationId,
  apiUrl,
  assistantId,
  initialThread,
  locale,
}: {
  children: ReactNode;
  apiKey: string;
  organizationId?: string;
  apiUrl: string;
  assistantId: string;
  initialThread?: string | null;
  locale?: string | null;
}) => {
  const [threadId, setThreadId] = useQueryState('threadId');
  const [values, setValues] = useState<StateType>({ messages: [] });
  const [historyMessageLoadVersion, setHistoryMessageLoadVersion] = useState(0);
  const [historyMessagePagination, setHistoryMessagePagination] =
    useState<HistoryMessagePaginationState>(() =>
      createEmptyHistoryMessagePagination(),
    );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [todos, setTodos] = useState<TodoListSnapshot | null>(null);
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>(
    [],
  );
  const [pendingRequestUserInput, setPendingRequestUserInput] =
    useState<PendingRequestUserInput | null>(null);
  const [autoQueuedFollowUpIds, setAutoQueuedFollowUpIds] = useState<string[]>(
    [],
  );
  const [contextUsageByAgentKey, setContextUsageByAgentKey] =
    useState<ThreadContextUsageByAgentKey>({});
  const [threadGoal, setThreadGoal] = useState<ThreadGoal | null>(null);
  const [runtimeClientSecret, setRuntimeClientSecret] = useState(apiKey);
  const [runtimeOrganizationId, setRuntimeOrganizationId] = useState<
    string | undefined
  >(organizationId);
  const abortRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const valuesRef = useRef<StateType>(values);
  const submitRef = useRef<StreamContextType['submit'] | null>(null);
  const todosRef = useRef<TodoListSnapshot | null>(null);
  const pendingFollowUpsRef = useRef<PendingFollowUp[]>([]);
  const pendingRequestUserInputRef = useRef<PendingRequestUserInput | null>(
    null,
  );
  const requestUserInputResolverRef = useRef<{
    resolve: (message: ClientToolMessageInput) => void;
    reject: (error: unknown) => void;
  } | null>(null);
  const autoQueuedFollowUpIdsRef = useRef<Set<string>>(new Set());
  const steerPriorityFollowUpIdsRef = useRef<Set<string>>(new Set());
  const queueDrainPromiseRef = useRef<Promise<void> | null>(null);
  const runtimeClientSecretRef = useRef(apiKey);
  const runtimeOrganizationIdRef = useRef<string | undefined>(organizationId);
  const refreshClientSecretPromiseRef =
    useRef<Promise<ResolvedClientSecret> | null>(null);
  const consumedInitialThreadRef = useRef<string | null>(null);
  const initialThreadLoadRef = useRef<{
    threadId: string | null;
    promise: Promise<void> | null;
  }>({
    threadId: null,
    promise: null,
  });
  const lastStreamOptionsRef = useRef<ResumeStreamOptions>({});
  const lastExecutionIdRef = useRef<string | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const historyMessagePaginationRef = useRef<HistoryMessagePaginationState>(
    createEmptyHistoryMessagePagination(),
  );
  const activeThreadIdRef = useRef<string | null>(threadId ?? null);
  const clientRef = useRef<Client<StateType> | null>(null);
  const shouldStartFreshAssistantMessageAfterSteerRef = useRef(false);
  // Track the previous threadId so we only reset SSE state on actual thread changes.
  const lastThreadIdRef = useRef<string | null>(threadId ?? null);
  const hasObservedThreadSelectionRef = useRef(
    normalizeThreadIdentifier(threadId) !== null,
  );
  const suppressThreadChangeRef = useRef(false);
  const { isParentAvailable, sendCommand, sendEvent } = useParentMessenger();
  const getRuntimeOrganizationId = useCallback(
    () => runtimeOrganizationIdRef.current,
    [],
  );

  useEffect(() => {
    activeThreadIdRef.current = threadId ?? null;
  }, [threadId]);
  const updateHistoryMessagePagination = useCallback(
    (
      next:
        | HistoryMessagePaginationState
        | ((
            previous: HistoryMessagePaginationState,
          ) => HistoryMessagePaginationState),
    ) => {
      setHistoryMessagePagination((previous) => {
        const resolved =
          typeof next === 'function' ? next(previous) : next;
        historyMessagePaginationRef.current = resolved;
        return resolved;
      });
    },
    [],
  );
  const updateTodos = useCallback((nextTodos: TodoListSnapshot | null) => {
    todosRef.current = nextTodos;
    setTodos(nextTodos);
  }, []);
  const updatePendingRequestUserInput = useCallback(
    (nextRequest: PendingRequestUserInput | null) => {
      pendingRequestUserInputRef.current = nextRequest;
      setPendingRequestUserInput(nextRequest);
    },
    [],
  );
  const clearPendingRequestUserInput = useCallback(
    (reason?: unknown) => {
      const resolver = requestUserInputResolverRef.current;
      requestUserInputResolverRef.current = null;
      updatePendingRequestUserInput(null);

      if (resolver) {
        resolver.reject(
          reason ??
            createAbortError('The pending user input request was cancelled.'),
        );
      }
    },
    [updatePendingRequestUserInput],
  );
  const waitForRequestUserInput = useCallback(
    (toolCall: ToolCall, params: RequestUserInputToolArgs) => {
      clearPendingRequestUserInput(
        createAbortError('A newer user input request replaced this one.'),
      );

      const requestId = toolCall.id ?? createMessageId();
      const pendingRequest: PendingRequestUserInput = {
        id: requestId,
        ...(toolCall.id ? { toolCallId: toolCall.id } : {}),
        params,
        createdAt: Date.now(),
      };

      updatePendingRequestUserInput(pendingRequest);

      return new Promise<ClientToolMessageInput>((resolve, reject) => {
        requestUserInputResolverRef.current = {
          resolve,
          reject,
        };
      });
    },
    [clearPendingRequestUserInput, updatePendingRequestUserInput],
  );
  const submitRequestUserInput = useCallback(
    (answers: RequestUserInputAnswer[]) => {
      const pendingRequest = pendingRequestUserInputRef.current;
      const resolver = requestUserInputResolverRef.current;
      if (!pendingRequest || !resolver) {
        return;
      }

      const content: RequestUserInputResult = {
        type: REQUEST_USER_INPUT_RESULT_TYPE,
        purpose: getRequestUserInputResultPurpose(pendingRequest.params),
        answers,
      };
      requestUserInputResolverRef.current = null;
      updatePendingRequestUserInput(null);
      resolver.resolve({
        tool_call_id: pendingRequest.toolCallId ?? pendingRequest.id,
        name: REQUEST_USER_INPUT_TOOL_NAME,
        content,
        status: 'success',
      });
    },
    [updatePendingRequestUserInput],
  );
  const submitHITLResponse = useCallback(
    async (response: HITLResponse, executionId?: string) => {
      let conversationId = conversationIdRef.current?.trim() || null;
      if (!conversationId) {
        const activeThreadId = activeThreadIdRef.current?.trim() || null;
        if (activeThreadId) {
          const activeClient = clientRef.current;
          if (!activeClient) {
            throw new Error('Missing Xpert client for HITL resume');
          }
          const conversationResult = await activeClient.conversations.search({
            where: { threadId: activeThreadId },
            limit: 1,
          });
          conversationId = conversationResult.items?.[0]?.id?.trim() ?? null;
          conversationIdRef.current = conversationId;
        }
      }
      if (!conversationId) {
        throw new Error('Missing conversation context for HITL resume');
      }

      const latestTarget = getLatestAssistantMessageTarget(
        valuesRef.current.messages ?? [],
      );
      const resumeInput = buildHITLResumeRunInput({
        response,
        conversationId,
        executionId:
          executionId ??
          latestTarget.executionId ??
          lastExecutionIdRef.current ??
          undefined,
        aiMessageId: latestTarget.aiMessageId,
      });

      return (
        submitRef.current?.(resumeInput, lastStreamOptionsRef.current) ??
        Promise.resolve()
      );
    },
    [],
  );
  const rememberHITLExecutionId = useCallback((executionId: string) => {
    lastExecutionIdRef.current = executionId;
  }, []);
  const {
    pendingHITLRequest,
    clearPendingHITLRequest,
    submitHITLDecision,
    hydratePendingHITLRequestFromOperation,
    handleHITLInterrupt,
  } = useHITLInterrupts({
    submitResponse: submitHITLResponse,
    setError,
    onExecutionId: rememberHITLExecutionId,
  });

  useEffect(() => {
    return () => {
      clearPendingRequestUserInput(
        createAbortError('The user input request was cancelled.'),
      );
      clearPendingHITLRequest(
        createAbortError('The HITL request was cancelled.'),
      );
    };
  }, [clearPendingHITLRequest, clearPendingRequestUserInput]);

  useEffect(() => {
    const nextOrganizationId = organizationId?.trim();
    runtimeClientSecretRef.current = apiKey;
    runtimeOrganizationIdRef.current = nextOrganizationId || undefined;
    setRuntimeClientSecret(apiKey);
    setRuntimeOrganizationId(nextOrganizationId || undefined);
  }, [apiKey, organizationId]);

  useEffect(() => {
    pendingFollowUpsRef.current = pendingFollowUps;
  }, [pendingFollowUps]);

  useEffect(() => {
    autoQueuedFollowUpIdsRef.current = new Set(autoQueuedFollowUpIds);
  }, [autoQueuedFollowUpIds]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Notify the host page when the active thread changes. The host maps
  // `public_event` -> `chatkit.<event>` so sending ['thread.change', {...}]
  // will become a `chatkit.thread.change` CustomEvent on the host element.
  useEffect(() => {
    const currentThreadId = normalizeThreadIdentifier(threadId);
    if (currentThreadId !== null) {
      hasObservedThreadSelectionRef.current = true;
    }
    if (!isParentAvailable) return;
    if (suppressThreadChangeRef.current) {
      suppressThreadChangeRef.current = false;
      return;
    }
    if (
      !shouldBroadcastThreadChange({
        threadId: currentThreadId,
        hasObservedThreadSelection: hasObservedThreadSelectionRef.current,
      })
    ) {
      return;
    }
    sendEvent('public_event', ['thread.change', { threadId: currentThreadId }]);
  }, [threadId, isParentAvailable, sendEvent]);

  const refreshClientSecret =
    useCallback(async (): Promise<ResolvedClientSecret> => {
      if (!isParentAvailable) {
        throw new Error(
          '[chatkit-ui] Parent window is not available for client secret refresh.',
        );
      }
      if (refreshClientSecretPromiseRef.current) {
        return refreshClientSecretPromiseRef.current;
      }

      const refreshPromise = (async () => {
        const currentSecret = runtimeClientSecretRef.current.trim();
        const response = await sendCommand(
          'onGetClientSecret',
          currentSecret || null,
        );
        const nextClientSecret = normalizeClientSecretResult(
          response,
          runtimeOrganizationIdRef.current,
        );

        runtimeClientSecretRef.current = nextClientSecret.secret;
        runtimeOrganizationIdRef.current = nextClientSecret.organizationId;
        setRuntimeClientSecret(nextClientSecret.secret);
        setRuntimeOrganizationId(nextClientSecret.organizationId);
        return nextClientSecret;
      })();

      refreshClientSecretPromiseRef.current = refreshPromise;
      try {
        return await refreshPromise;
      } finally {
        if (refreshClientSecretPromiseRef.current === refreshPromise) {
          refreshClientSecretPromiseRef.current = null;
        }
      }
    }, [isParentAvailable, sendCommand]);

  const fetchWithClientSecretRefresh = useMemo(
    () =>
      createFetchWithClientSecretRefresh({
        getCurrentClientSecret: () => {
          const currentSecret = runtimeClientSecretRef.current.trim();
          const currentOrganizationId =
            runtimeOrganizationIdRef.current?.trim();

          return currentOrganizationId
            ? { secret: currentSecret, organizationId: currentOrganizationId }
            : { secret: currentSecret };
        },
        refreshClientSecret,
        onRefreshError: (refreshError) => {
          console.warn(
            '[chatkit-ui] Failed to refresh client secret:',
            refreshError,
          );
        },
      }),
    [refreshClientSecret],
  );

  const client = useMemo(
    () =>
      new Client<StateType>({
        apiUrl,
        defaultHeaders: createLanguageHeaders(locale),
        callerOptions: {
          fetch: fetchWithClientSecretRefresh,
        },
        onRequest: (url: URL, init: RequestInit) => {
          const lastEventId = lastEventIdRef.current;
          if (lastEventId && url.pathname.endsWith('/runs/stream')) {
            const headers = init.headers;
            if (!headers) {
              init.headers = { 'Last-Event-ID': lastEventId };
              return init;
            }
            if (headers instanceof Headers) {
              headers.set('Last-Event-ID', lastEventId);
              return init;
            }
            if (Array.isArray(headers)) {
              init.headers = [...headers, ['Last-Event-ID', lastEventId]];
              return init;
            }
            (headers as Record<string, string>)['Last-Event-ID'] = lastEventId;
          }
          return init;
        },
      }),
    [apiUrl, fetchWithClientSecretRefresh, locale],
  );
  clientRef.current = client;
  const runtimeActivitiesEnabled =
    createMissingApiConfigurationError({
      apiUrl,
      clientSecret: runtimeClientSecret,
    }) === null;

  useEffect(() => {
    logRuntimeActivity('stream config', {
      threadId: threadId ?? null,
      enabled: runtimeActivitiesEnabled,
      hasApiUrl: apiUrl.trim().length > 0,
      hasClientSecret: runtimeClientSecret.trim().length > 0,
      organizationId: runtimeOrganizationId ?? null,
    });
  }, [
    apiUrl,
    runtimeActivitiesEnabled,
    runtimeClientSecret,
    runtimeOrganizationId,
    threadId,
  ]);

  const {
    runtimeActivities,
    clearRuntimeActivities,
    refreshSandboxServices,
    handleRuntimeActivityTrigger,
    stopRuntimeActivityItem,
  } = useRuntimeActivities<StateType>({
    client,
    threadId: threadId ?? null,
    enabled: runtimeActivitiesEnabled,
    getOrganizationId: getRuntimeOrganizationId,
    setError,
  });

  useEffect(() => {
    const currentThreadId = threadId ?? null;
    if (lastThreadIdRef.current !== currentThreadId) {
      lastThreadIdRef.current = currentThreadId;
      lastEventIdRef.current = null;
      setContextUsageByAgentKey({});
      clearPendingRequestUserInput(
        createAbortError('The user input request was cancelled.'),
      );
      clearPendingHITLRequest(
        createAbortError('The HITL request was cancelled.'),
      );
    }
  }, [clearPendingHITLRequest, clearPendingRequestUserInput, threadId]);

  const stop = useCallback(() => {
    const activeThreadId = activeThreadIdRef.current ?? threadId ?? null;
    const activeRunId = lastExecutionIdRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    clearPendingRequestUserInput(
      createAbortError('The user input request was cancelled.'),
    );
    clearPendingHITLRequest(
      createAbortError('The HITL request was cancelled.'),
    );
    setIsLoading(false);
    if (activeThreadId && activeRunId) {
      client.runs
        .cancel(activeThreadId, activeRunId, false)
        .catch(() => undefined);
    }
  }, [clearPendingHITLRequest, clearPendingRequestUserInput, client, threadId]);

  const addAutoQueuedFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const nextQueuedIds = new Set(autoQueuedFollowUpIdsRef.current);
    for (const id of ids) {
      if (id) {
        nextQueuedIds.add(id);
      }
    }
    autoQueuedFollowUpIdsRef.current = nextQueuedIds;
    setAutoQueuedFollowUpIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (id) {
          next.add(id);
        }
      }
      return [...next];
    });
  }, []);

  const removeAutoQueuedFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    autoQueuedFollowUpIdsRef.current = new Set(
      [...autoQueuedFollowUpIdsRef.current].filter((id) => !idSet.has(id)),
    );
    setAutoQueuedFollowUpIds((prev) => prev.filter((id) => !idSet.has(id)));
  }, []);

  const addSteerPriorityFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const nextIds = new Set(steerPriorityFollowUpIdsRef.current);
    for (const id of ids) {
      if (id) {
        nextIds.add(id);
      }
    }
    steerPriorityFollowUpIdsRef.current = nextIds;
  }, []);

  const removeSteerPriorityFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    steerPriorityFollowUpIdsRef.current = new Set(
      [...steerPriorityFollowUpIdsRef.current].filter(
        (id) => !idSet.has(id),
      ),
    );
  }, []);

  const removePendingFollowUps = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      pendingFollowUpsRef.current = pendingFollowUpsRef.current.filter(
        (item) => !idSet.has(item.id),
      );
      setPendingFollowUps((prev) => prev.filter((item) => !idSet.has(item.id)));
      removeAutoQueuedFollowUpIds(ids);
      removeSteerPriorityFollowUpIds(ids);
    },
    [removeAutoQueuedFollowUpIds, removeSteerPriorityFollowUpIds],
  );

  const removePendingFollowUp = useCallback(
    (id: string) => {
      if (!id) return;
      const targetItem = pendingFollowUpsRef.current.find(
        (item) => item.id === id,
      );
      if (!targetItem || targetItem.mode !== 'queue') {
        return;
      }
      removePendingFollowUps([id]);
    },
    [removePendingFollowUps],
  );

  const markPendingFollowUpsAsQueued = useCallback(
    (
      ids: string[],
      options?: { autoDrain?: boolean; queuedFromSteer?: boolean },
    ) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const markQueued = (item: PendingFollowUp): PendingFollowUp =>
        idSet.has(item.id)
          ? {
              ...item,
              mode: 'queue' as const,
              request: {
                ...item.request,
                followUpMode: 'queue',
              },
              queuedFromSteer: options?.queuedFromSteer ?? item.queuedFromSteer,
            }
          : item;
      pendingFollowUpsRef.current = pendingFollowUpsRef.current.map(markQueued);
      setPendingFollowUps((prev) => prev.map(markQueued));
      if (options?.autoDrain === true) {
        addAutoQueuedFollowUpIds(ids);
      } else if (options?.autoDrain === false) {
        removeAutoQueuedFollowUpIds(ids);
      }
    },
    [addAutoQueuedFollowUpIds, removeAutoQueuedFollowUpIds],
  );

  const insertPendingFollowUpsIntoTranscript = useCallback(
    (items: PendingFollowUp[], visibleAt?: string | null) => {
      const nextMessages = items
        .map((item) => pendingFollowUpToUiMessage(item, visibleAt))
        .filter(
          (
            item,
          ): item is NonNullable<
            ReturnType<typeof pendingFollowUpToUiMessage>
          > => Boolean(item),
        );
      appendMessages(setValues, nextMessages as ChatKitAIMessage[]);
    },
    [],
  );

  const flushSteerFollowUps = useCallback(
    (ids: string[], visibleAt?: string | null) => {
      if (ids.length === 0) {
        return;
      }

      const idSet = new Set(ids);
      const steerItems = pendingFollowUpsRef.current
        .filter(
          (item) =>
            item.mode === 'steer' &&
            (idSet.has(item.id) || idSet.has(item.clientMessageId)),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      if (steerItems.length === 0) {
        return;
      }

      insertPendingFollowUpsIntoTranscript(steerItems, visibleAt);
      removePendingFollowUps(steerItems.map((item) => item.id));
    },
    [insertPendingFollowUpsIntoTranscript, removePendingFollowUps],
  );

  const loadConversationMessages = useCallback(
    async (recordId: string) => {
      const configError = createMissingApiConfigurationError({
        apiUrl,
        clientSecret: runtimeClientSecret,
      });
      if (configError) {
        throw configError;
      }
      try {
        stop();
      } catch {
        // ignore stop errors from an already-idle stream
      }
      updateTodos(null);
      activeThreadIdRef.current = null;
      clearRuntimeActivities();
      conversationIdRef.current = recordId;
      updateHistoryMessagePagination({
        ...createEmptyHistoryMessagePagination(),
        conversationId: recordId,
      });
      const [conversationDetail, response] = await Promise.all([
        client.conversations.get(recordId).catch((detailError) => {
          console.warn(
            '[chatkit-ui] Failed to load conversation detail for pending HITL',
            detailError,
          );
          return null;
        }),
        client.conversations.searchMessages(
          recordId,
          createConversationMessagesPageQuery(0),
        ),
      ]);
      if (conversationIdRef.current !== recordId) {
        return [];
      }
      const page = normalizeConversationMessagesPage(response);
      steerPriorityFollowUpIdsRef.current = new Set();
      const autoDrainIds = getAutoDrainQueuedFollowUpIds(
        page.pendingFollowUps,
      );
      autoQueuedFollowUpIdsRef.current = new Set(autoDrainIds);
      pendingFollowUpsRef.current = page.pendingFollowUps;
      setAutoQueuedFollowUpIds(autoDrainIds);
      setPendingFollowUps(page.pendingFollowUps);
      const latestExecutionId = getLatestExecutionIdFromMessages(page.messages);
      lastExecutionIdRef.current = latestExecutionId;
      const loadedThreadId = getConversationThreadId(conversationDetail);
      if (loadedThreadId) {
        activeThreadIdRef.current = loadedThreadId;
        setThreadId(loadedThreadId);
      }
      updateHistoryMessagePagination({
        conversationId: recordId,
        loadedCount: page.loadedCount,
        total: page.total,
        hasMore: page.hasMore,
        isLoadingMore: false,
      });
      setValues({ messages: page.messages ?? [] });
      setHistoryMessageLoadVersion((version) => version + 1);
      hydratePendingHITLRequestFromOperation(
        (conversationDetail as { operation?: unknown } | null)?.operation,
        latestExecutionId,
      );
      return page.messages as ChatKitAIMessage[];
    },
    [
      apiUrl,
      clearRuntimeActivities,
      client,
      hydratePendingHITLRequestFromOperation,
      runtimeClientSecret,
      setThreadId,
      stop,
      updateHistoryMessagePagination,
      updateTodos,
    ],
  );

  const loadMoreConversationMessages = useCallback(async () => {
    const pagination = historyMessagePaginationRef.current;
    const recordId = pagination.conversationId;
    if (!recordId || !pagination.hasMore || pagination.isLoadingMore) {
      return [];
    }

    const configError = createMissingApiConfigurationError({
      apiUrl,
      clientSecret: runtimeClientSecret,
    });
    if (configError) {
      throw configError;
    }

    updateHistoryMessagePagination((previous) =>
      previous.conversationId === recordId
        ? { ...previous, isLoadingMore: true }
        : previous,
    );

    try {
      const response = await client.conversations.searchMessages(
        recordId,
        createConversationMessagesPageQuery(pagination.loadedCount),
      );
      const page = normalizeConversationMessagesPage(
        response,
        pagination.loadedCount,
      );

      if (conversationIdRef.current !== recordId) {
        updateHistoryMessagePagination((previous) =>
          previous.conversationId === recordId
            ? { ...previous, isLoadingMore: false }
            : previous,
        );
        return [];
      }

      if (page.pendingFollowUps.length > 0) {
        const mergeLoadedPendingFollowUps = (previous: PendingFollowUp[]) =>
          mergePendingFollowUps(previous, page.pendingFollowUps);
        pendingFollowUpsRef.current = mergeLoadedPendingFollowUps(
          pendingFollowUpsRef.current,
        );
        setPendingFollowUps((previous) =>
          mergeLoadedPendingFollowUps(previous),
        );
        addAutoQueuedFollowUpIds(
          getAutoDrainQueuedFollowUpIds(page.pendingFollowUps),
        );
      }

      setValues((previous) => ({
        ...previous,
        messages: mergeHistoryUiMessages(
          previous.messages ?? [],
          page.messages,
        ),
      }));
      updateHistoryMessagePagination((previous) =>
        previous.conversationId === recordId
          ? {
              conversationId: recordId,
              loadedCount: page.loadedCount,
              total: page.total,
              hasMore: page.hasMore,
              isLoadingMore: false,
            }
          : previous,
      );
      setHistoryMessageLoadVersion((version) => version + 1);
      return page.messages as ChatKitAIMessage[];
    } catch (error) {
      updateHistoryMessagePagination((previous) =>
        previous.conversationId === recordId
          ? { ...previous, isLoadingMore: false }
          : previous,
      );
      throw error;
    }
  }, [
    addAutoQueuedFollowUpIds,
    apiUrl,
    client,
    runtimeClientSecret,
    updateHistoryMessagePagination,
  ]);

  const reset = useCallback(
    (
      newThreadId?: string | null,
      initialMessages?: ChatKitAIMessage[],
      options?: { suppressThreadChange?: boolean },
    ) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsLoading(false);
      setError(null);
      clearPendingRequestUserInput(
        createAbortError('The user input request was cancelled.'),
      );
      clearPendingHITLRequest(
        createAbortError('The HITL request was cancelled.'),
      );
      setPendingFollowUps([]);
      setAutoQueuedFollowUpIds([]);
      pendingFollowUpsRef.current = [];
      autoQueuedFollowUpIdsRef.current = new Set();
      steerPriorityFollowUpIdsRef.current = new Set();
      updateTodos(null);
      clearRuntimeActivities();
      setContextUsageByAgentKey({});
      setThreadGoal(null);
      setValues({ messages: initialMessages ?? [] });
      updateHistoryMessagePagination(createEmptyHistoryMessagePagination());
      conversationIdRef.current = null;
      activeThreadIdRef.current = newThreadId ?? null;
      shouldStartFreshAssistantMessageAfterSteerRef.current = false;
      lastExecutionIdRef.current = null;
      lastEventIdRef.current = null;
      if (newThreadId !== undefined) {
        if (options?.suppressThreadChange && newThreadId !== threadId) {
          suppressThreadChangeRef.current = true;
        }
        setThreadId(newThreadId);
      }
    },
    [
      clearPendingHITLRequest,
      clearPendingRequestUserInput,
      clearRuntimeActivities,
      setThreadId,
      threadId,
      updateHistoryMessagePagination,
      updateTodos,
    ],
  );

  const handleInterrupt = useCallback(
    async (data: unknown) => {
      const requests = collectClientToolRequests(data);

      const toolMessages: ClientToolMessageInput[] = [];
      for (const request of requests) {
        const calls = request.clientToolCalls ?? [];
        for (const call of calls) {
          let response: unknown;
          try {
            response = await resolveClientToolCallResponse(call, {
              isParentAvailable,
              sendCommand,
              waitForRequestUserInput,
            });
            if (!response) {
              continue;
            }
          } catch (requestError) {
            if (isAbortError(requestError)) {
              continue;
            }
            setError(requestError);
            continue;
          }

          const toolMessage = normalizeToolMessagesResponse(response);
          if (!toolMessage) continue;

          toolMessages.push(toolMessage);
        }
      }

      if (toolMessages.length > 0) {
        await submitRef.current?.(
          {
            input: {},
            command: {
              resume: {
                toolMessages: toolMessages,
              } as ClientToolResponse,
            },
            executionId: lastExecutionIdRef.current ?? undefined,
          },
          lastStreamOptionsRef.current,
        );
      }

      await handleHITLInterrupt(data);
    },
    [
      handleHITLInterrupt,
      isParentAvailable,
      sendCommand,
      setError,
      waitForRequestUserInput,
    ],
  );

  const resolveConversationId = useCallback(
    async (nextThreadId: string) => {
      if (!nextThreadId) {
        return null;
      }

      const cachedConversationId = conversationIdRef.current?.trim();
      if (cachedConversationId) {
        return cachedConversationId;
      }

      const conversationResult = await client.conversations.search({
        where: { threadId: nextThreadId },
        limit: 1,
      });
      const conversationId = conversationResult.items?.[0]?.id?.trim() ?? null;
      conversationIdRef.current = conversationId;
      return conversationId;
    },
    [client],
  );

  const sendSteerFollowUp = useCallback(
    async (
      nextThreadId: string,
      input: TChatRequest,
      options?: StreamSubmitOptions,
    ) => {
      const normalizedRequest = normalizeRequestContextAndConfig({
        context: options?.context,
        config: options?.config,
      });
      const conversationId = await resolveConversationId(nextThreadId);
      const explicitFollowUpInput = buildSteerFollowUpRunInput({
        request: input,
        conversationId,
        targetExecutionId:
          (typeof input.executionId === 'string' && input.executionId.trim()) ||
          lastExecutionIdRef.current,
        messages: valuesRef.current.messages ?? [],
      });

      if (!explicitFollowUpInput) {
        throw new Error('Missing conversation context for steer follow-up');
      }

      await client.runs.create(nextThreadId, assistantId, {
        input: explicitFollowUpInput,
        context: normalizedRequest.context,
        config: normalizedRequest.config as Config | undefined,
      });
    },
    [assistantId, client, resolveConversationId],
  );

  const promotePendingFollowUpToSteer = useCallback(
    async (id: string) => {
      if (!id || !isLoadingRef.current) {
        return;
      }

      const currentItem = pendingFollowUpsRef.current.find(
        (item) => item.id === id && item.mode === 'queue',
      );
      if (!currentItem) {
        return;
      }
      removeAutoQueuedFollowUpIds([id]);
      addSteerPriorityFollowUpIds([id]);

      const targetExecutionId =
        lastExecutionIdRef.current ??
        currentItem.request.executionId ??
        currentItem.targetExecutionId ??
        undefined;

      const nextRequest: TChatRequest = {
        ...currentItem.request,
        ...(targetExecutionId ? { executionId: targetExecutionId } : {}),
        followUpMode: 'steer',
      };

      const steerItem: PendingFollowUp = {
        ...currentItem,
        mode: 'steer',
        request: nextRequest,
        targetExecutionId: targetExecutionId ?? null,
        queuedFromSteer: true,
      };
      pendingFollowUpsRef.current = movePendingFollowUpBeforeQueuedItems(
        pendingFollowUpsRef.current,
        id,
        steerItem,
      );
      setPendingFollowUps((prev) =>
        movePendingFollowUpBeforeQueuedItems(prev, id, steerItem),
      );

      const activeThreadId = activeThreadIdRef.current ?? threadId ?? null;
      if (!activeThreadId) {
        markPendingFollowUpsAsQueued([id], {
          autoDrain: true,
          queuedFromSteer: true,
        });
        return;
      }

      try {
        await sendSteerFollowUp(activeThreadId, nextRequest, {
          ...(currentItem.context ? { context: currentItem.context } : {}),
          ...(currentItem.config ? { config: currentItem.config } : {}),
        });
      } catch (followUpError) {
        setError(followUpError);
        markPendingFollowUpsAsQueued([id], {
          autoDrain: true,
          queuedFromSteer: true,
        });
      }
    },
    [
      addSteerPriorityFollowUpIds,
      markPendingFollowUpsAsQueued,
      removeAutoQueuedFollowUpIds,
      sendSteerFollowUp,
      setError,
      threadId,
    ],
  );

  const autoQueuedFollowUpIdSet = useMemo(
    () => new Set(autoQueuedFollowUpIds),
    [autoQueuedFollowUpIds],
  );

  const canSendPendingFollowUpNow = useCallback(
    (id: string) => {
      if (!id || isLoadingRef.current || autoQueuedFollowUpIdSet.has(id)) {
        return false;
      }

      return pendingFollowUpsRef.current.some(
        (item) => item.id === id && item.mode === 'queue',
      );
    },
    [autoQueuedFollowUpIdSet],
  );

  const sendPendingFollowUpNow = useCallback(
    async (id: string) => {
      if (!id || isLoadingRef.current) {
        return;
      }

      const nextItem = pendingFollowUpsRef.current.find(
        (item) => item.id === id && item.mode === 'queue',
      );
      if (!nextItem) {
        return;
      }

      const groupedItems = getQueuedFollowUpGroup(
        pendingFollowUpsRef.current,
        nextItem,
      );
      const mergedGroup = mergeQueuedFollowUpGroup(groupedItems, {
        leadItemId: id,
      });
      if (!mergedGroup) {
        return;
      }

      removePendingFollowUps(mergedGroup.items.map((item) => item.id));
      insertPendingFollowUpsIntoTranscript(mergedGroup.items);
      await submitRef.current?.(toQueuedSendRequest(mergedGroup.request), {
        ...(mergedGroup.context ? { context: mergedGroup.context } : {}),
        ...(mergedGroup.config ? { config: mergedGroup.config } : {}),
        threadId: activeThreadIdRef.current ?? threadId ?? undefined,
      });
    },
    [insertPendingFollowUpsIntoTranscript, removePendingFollowUps, threadId],
  );

  const drainQueuedFollowUps = useCallback(async () => {
    if (queueDrainPromiseRef.current || isLoadingRef.current) {
      return queueDrainPromiseRef.current ?? Promise.resolve();
    }

    const drainPromise = (async () => {
      while (!isLoadingRef.current) {
        const nextItem = getNextAutoQueuedFollowUp(
          pendingFollowUpsRef.current,
          autoQueuedFollowUpIdsRef.current,
          steerPriorityFollowUpIdsRef.current,
        );

        if (!nextItem) {
          break;
        }

        const groupedItems = getQueuedFollowUpGroup(
          pendingFollowUpsRef.current,
          nextItem,
        );
        const mergedGroup = mergeQueuedFollowUpGroup(groupedItems, {
          leadItemId: nextItem.id,
        });
        if (!mergedGroup) {
          break;
        }

        removePendingFollowUps(mergedGroup.items.map((item) => item.id));
        insertPendingFollowUpsIntoTranscript(mergedGroup.items);
        await submitRef.current?.(toQueuedSendRequest(mergedGroup.request), {
          ...(mergedGroup.context ? { context: mergedGroup.context } : {}),
          ...(mergedGroup.config ? { config: mergedGroup.config } : {}),
          threadId: activeThreadIdRef.current ?? threadId ?? undefined,
        });
      }
    })().finally(() => {
      if (queueDrainPromiseRef.current === drainPromise) {
        queueDrainPromiseRef.current = null;
      }
    });

    queueDrainPromiseRef.current = drainPromise;
    return drainPromise;
  }, [insertPendingFollowUpsIntoTranscript, removePendingFollowUps, threadId]);

  const runStream = useCallback(
    async (
      nextThreadId: string,
      input?: StreamRunInput | null,
      options?: StreamSubmitOptions,
      runId?: string,
      preservedMessages?: ChatKitAIMessage[],
    ) => {
      const abortController = new AbortController();
      abortRef.current?.abort();
      abortRef.current = abortController;
      setIsLoading(true);
      try {
        const normalizedRequest = normalizeRequestContextAndConfig({
          context: options?.context,
          config: options?.config,
        });
        const stream =
          options?.joinExistingThread && runId
            ? client.runs.joinStream(nextThreadId, runId)
            : client.runs.stream(nextThreadId, assistantId, {
                input: input ?? null,
                context: normalizedRequest.context,
                config: normalizedRequest.config as Config | undefined,
                checkpoint: options?.checkpoint ?? undefined,
                streamMode: options?.streamMode,
                streamSubgraphs: options?.streamSubgraphs,
                streamResumable: options?.streamResumable,
                signal: abortController.signal,
                onDisconnect: 'continue',
              });

        const interrupts: unknown[] = [];
        const langGraphEventState = createLangGraphEventState();
        const eventContext: LangGraphEventContext = {
          threadId: nextThreadId,
          input,
        };
        for await (const chunk of stream) {
          if (chunk?.id) {
            lastEventIdRef.current = String(chunk.id);
          }
          applyStreamEvent(
            chunk as StreamChunk,
            setValues,
            setError,
            sendEvent,
            interrupts,
            langGraphEventState,
            eventContext,
            (executionId) => {
              if (executionId) {
                lastExecutionIdRef.current = executionId;
              }
            },
            (event) => {
              setContextUsageByAgentKey((prev) =>
                applyThreadContextUsageEvent(prev, event, nextThreadId),
              );
            },
            (event) => {
              const consumedIds = resolveFollowUpConsumedIds(event);
              if (event?.mode === 'steer') {
                flushSteerFollowUps(consumedIds, event?.visibleAt ?? null);
                shouldStartFreshAssistantMessageAfterSteerRef.current = true;
                return;
              }

              removePendingFollowUps(consumedIds);
            },
            () => {
              const shouldStartFreshAssistant =
                shouldStartFreshAssistantMessageAfterSteerRef.current;
              shouldStartFreshAssistantMessageAfterSteerRef.current = false;
              return shouldStartFreshAssistant;
            },
            () => todosRef.current,
            (snapshot) => {
              updateTodos(snapshot);
            },
            handleRuntimeActivityTrigger,
            (goal) => {
              if (goal.threadId === nextThreadId) {
                setThreadGoal(goal);
              }
            },
            (goalThreadId) => {
              if (goalThreadId === nextThreadId) {
                setThreadGoal(null);
              }
            },
            (event) => {
              setThreadGoal((previous) => {
                if (!previous) {
                  return previous;
                }
                if (event.threadId && event.threadId !== nextThreadId) {
                  return previous;
                }
                if (
                  event.goalId &&
                  previous.id &&
                  event.goalId !== previous.id
                ) {
                  return previous;
                }
                return {
                  ...previous,
                  ...event.goal,
                  threadId: event.goal.threadId ?? previous.threadId,
                  objective: event.goal.objective ?? previous.objective,
                  status: event.goal.status,
                };
              });
            },
            preservedMessages,
          );
        }

        if (interrupts.length > 0) {
          for await (const interruptData of interrupts) {
            await handleInterrupt(interruptData);
          }
        }
      } catch (streamError) {
        if (
          !(
            streamError instanceof DOMException &&
            streamError.name === 'AbortError'
          )
        ) {
          setError(streamError);
        }
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
        shouldStartFreshAssistantMessageAfterSteerRef.current = false;
        const staleSteerIds = getPendingSteerFollowUpIds(
          pendingFollowUpsRef.current,
          steerPriorityFollowUpIdsRef.current,
        );
        if (staleSteerIds.length > 0) {
          markPendingFollowUpsAsQueued(staleSteerIds, {
            autoDrain: true,
            queuedFromSteer: true,
          });
        }
        setIsLoading(false);
      }
    },
    [
      assistantId,
      client,
      sendEvent,
      handleInterrupt,
      flushSteerFollowUps,
      markPendingFollowUpsAsQueued,
      removePendingFollowUps,
      updateTodos,
      handleRuntimeActivityTrigger,
    ],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }
    void drainQueuedFollowUps();
  }, [drainQueuedFollowUps, isLoading]);

  const loadThread = useCallback(
    async (threadId: string) => {
      if (!threadId) return;
      if (
        threadId === (lastThreadIdRef.current ?? null) &&
        isLoadingRef.current
      ) {
        return;
      }
      setError(null);
      updateTodos(null);
      clearRuntimeActivities();

      try {
        stop();
      } catch {
        // ignore stop errors from an already-idle stream
      }

      setThreadId(threadId);
      activeThreadIdRef.current = threadId;
      lastEventIdRef.current = null;

      const conversationResult = await client.conversations.search({
        where: { threadId: threadId },
        limit: 1,
      });

      const conversation = conversationResult.items?.[0];
      if (!conversation?.id) {
        conversationIdRef.current = null;
        setPendingFollowUps([]);
        updateHistoryMessagePagination(createEmptyHistoryMessagePagination());
        setValues({ messages: [] });
        return;
      }

      let conversationDetail = conversation;
      if (
        String(conversation.status ?? '').toLowerCase() === 'interrupted' &&
        (conversation as { operation?: unknown }).operation == null
      ) {
        try {
          conversationDetail = await client.conversations.get(conversation.id);
        } catch (detailError) {
          console.warn(
            '[chatkit-ui] Failed to load conversation detail for pending HITL',
            detailError,
          );
        }
      }

      conversationIdRef.current = conversation.id;
      const loadedMessages = await loadConversationMessages(conversation.id);
      await refreshSandboxServices({
        targetThreadId: threadId,
        force: true,
      });
      const latestExecutionId = getLatestExecutionIdFromMessages(
        loadedMessages as ChatKitAIMessage[],
      );
      if (latestExecutionId) {
        lastExecutionIdRef.current = latestExecutionId;
      }
      const hasPendingHITL = hydratePendingHITLRequestFromOperation(
        (conversationDetail as { operation?: unknown }).operation,
        latestExecutionId,
      );
      if (hasPendingHITL) return;

      const status = String(
        conversationDetail.status ?? conversation.status ?? '',
      ).toLowerCase();
      if (status === 'interrupted') return;
      const shouldJoinStream =
        !status || status === 'running' || status === 'busy';
      if (!shouldJoinStream) return;

      const lastAiMessageResult = await client.conversations.searchMessages(
        conversation.id,
        {
          where: { role: 'ai' },
          order: { createdAt: 'DESC' },
          limit: 1,
        },
      );
      const runId = lastAiMessageResult.items?.[0]?.executionId ?? null;
      if (!runId) return;
      lastExecutionIdRef.current = runId;

      await runStream(threadId, null, { joinExistingThread: true }, runId);
    },
    [
      client,
      runStream,
      stop,
      loadConversationMessages,
      hydratePendingHITLRequestFromOperation,
      clearRuntimeActivities,
      refreshSandboxServices,
      setThreadId,
      updateHistoryMessagePagination,
      updateTodos,
    ],
  );

  useEffect(() => {
    const requestedInitialThread = normalizeThreadIdentifier(initialThread);
    const activeThreadId = normalizeThreadIdentifier(threadId);

    if (!requestedInitialThread) {
      consumedInitialThreadRef.current = null;
      return;
    }

    if (requestedInitialThread === activeThreadId) {
      consumedInitialThreadRef.current = requestedInitialThread;
      return;
    }

    if (consumedInitialThreadRef.current === requestedInitialThread) {
      return;
    }

    const configError = createMissingApiConfigurationError({
      apiUrl,
      clientSecret: runtimeClientSecret,
    });
    if (configError) {
      return;
    }

    const inFlightThread = initialThreadLoadRef.current.threadId;
    if (
      inFlightThread === requestedInitialThread &&
      initialThreadLoadRef.current.promise
    ) {
      return;
    }

    consumedInitialThreadRef.current = requestedInitialThread;
    const promise = loadThread(requestedInitialThread).catch((error) => {
      setError(error);
      console.warn('[chatkit-ui] Failed to load initial thread', error);
    });
    initialThreadLoadRef.current = {
      threadId: requestedInitialThread,
      promise,
    };
    void promise.finally(() => {
      if (initialThreadLoadRef.current.promise === promise) {
        initialThreadLoadRef.current = {
          threadId: null,
          promise: null,
        };
      }
    });
  }, [
    apiUrl,
    initialThread,
    loadThread,
    runtimeClientSecret,
    setError,
    threadId,
  ]);

  const submit = useCallback(
    async (input?: StreamRunInput | null, options?: StreamSubmitOptions) => {
      setError(null);
      const followUpMode = isLoadingRef.current
        ? options?.followUpMode
        : undefined;
      const humanInput = input && 'input' in input ? input : null;
      if (humanInput && followUpMode) {
        const pending = createPendingFollowUp(
          {
            ...humanInput,
            id: humanInput.id ?? createMessageId(),
            executionId:
              humanInput.executionId ?? lastExecutionIdRef.current ?? undefined,
            followUpMode,
          },
          followUpMode,
          options,
        );

        if (!pending) {
          return;
        }

        const addPending = (prev: PendingFollowUp[]) => {
          const remaining = prev.filter((item) => item.id !== pending.id);
          if (pending.mode === 'steer') {
            return movePendingFollowUpBeforeQueuedItems(
              remaining,
              pending.id,
              {
                ...pending,
                queuedFromSteer: true,
              },
            );
          }

          return [...remaining, pending];
        };
        pendingFollowUpsRef.current = addPending(pendingFollowUpsRef.current);
        setPendingFollowUps(addPending);
        if (followUpMode === 'queue') {
          addAutoQueuedFollowUpIds([pending.id]);
        }

        const activeThreadId = activeThreadIdRef.current ?? threadId ?? null;
        if (followUpMode === 'steer' && activeThreadId) {
          addSteerPriorityFollowUpIds([pending.id]);
          try {
            await sendSteerFollowUp(activeThreadId, pending.request, options);
          } catch (followUpError) {
            setError(followUpError);
            markPendingFollowUpsAsQueued([pending.id], {
              autoDrain: true,
              queuedFromSteer: true,
            });
          }
        }
        return;
      }

      const previousThreadId = threadId ?? null;
      lastStreamOptionsRef.current = retainResumeStreamOptions(options);
      const shouldStartNewThread = options?.newThread === true;
      if (shouldStartNewThread) {
        setValues({ messages: [] });
        setContextUsageByAgentKey({});
        updateTodos(null);
        clearRuntimeActivities();
        updateHistoryMessagePagination(createEmptyHistoryMessagePagination());
        lastExecutionIdRef.current = null;
        lastEventIdRef.current = null;
      }
      const optimistic = options?.optimisticValues;
      let preservedMessages: ChatKitAIMessage[] | undefined;
      if (optimistic) {
        const previousValues = valuesRef.current;
        const optimisticValues = applyOptimisticValues(
          previousValues,
          optimistic,
        );
        if (options?.preserveOptimisticMessages) {
          const previousIds = new Set(
            (previousValues.messages ?? [])
              .map((message) => message.id)
              .filter(
                (id): id is string => typeof id === 'string' && id.length > 0,
              ),
          );
          preservedMessages = (optimisticValues.messages ?? []).filter(
            (message) => {
              const messageId = message.id;
              return (
                typeof messageId === 'string' &&
                messageId.length > 0 &&
                !previousIds.has(messageId)
              );
            },
          );
        }
        setValues(optimisticValues);
      }

      let nextThreadId = threadId ?? null;
      const desiredThreadId = options?.threadId ?? null;
      if (shouldStartNewThread) {
        nextThreadId = null;
      }
      if (!nextThreadId && isResumeRunInput(input)) {
        const conversation = await client.conversations.get(
          input.conversationId,
        );
        const resumeThreadId = getConversationThreadId(conversation);
        if (!resumeThreadId) {
          throw new Error('Missing thread context for HITL resume');
        }

        nextThreadId = resumeThreadId;
        conversationIdRef.current = input.conversationId;
        activeThreadIdRef.current = resumeThreadId;
        setThreadId(resumeThreadId);
      }
      if (!nextThreadId && desiredThreadId && options?.joinExistingThread) {
        nextThreadId = desiredThreadId;
        activeThreadIdRef.current = desiredThreadId;
        setThreadId(desiredThreadId);
      }
      if (!nextThreadId && desiredThreadId) {
        const created = await client.threads.create({
          threadId: desiredThreadId,
          ifExists: 'raise',
        });
        nextThreadId = created.thread_id;
        setThreadId(created.thread_id);
      }
      if (!nextThreadId) {
        const created = await client.threads.create();
        nextThreadId = created.thread_id;
        setThreadId(created.thread_id);
      }
      if (desiredThreadId && desiredThreadId !== nextThreadId) {
        nextThreadId = desiredThreadId;
        setThreadId(desiredThreadId);
      }
      if (options?.onThreadResolved) {
        void Promise.resolve(options.onThreadResolved(nextThreadId)).catch(
          (callbackError) => {
            console.warn(
              '[chatkit-ui] Failed to run thread resolved callback',
              callbackError,
            );
          },
        );
      }
      if (nextThreadId !== previousThreadId) {
        lastEventIdRef.current = null;
      }
      activeThreadIdRef.current = nextThreadId;

      await runStream(
        nextThreadId,
        input,
        options,
        undefined,
        preservedMessages,
      );
    },
    [
      client,
      addAutoQueuedFollowUpIds,
      addSteerPriorityFollowUpIds,
      markPendingFollowUpsAsQueued,
      runStream,
      clearRuntimeActivities,
      sendSteerFollowUp,
      setThreadId,
      threadId,
      updateHistoryMessagePagination,
      updateTodos,
    ],
  );

  submitRef.current = submit;

  // isReady is true when we have a valid client secret (starts with 'cs-x-')
  const isReady = Boolean(
    runtimeClientSecret && runtimeClientSecret.startsWith('cs-x-'),
  );

  const value: StreamContextType = {
    client,
    apiUrl,
    assistantId,
    apiKey: runtimeClientSecret,
    organizationId: runtimeOrganizationId,
    threadId: threadId ?? null,
    threadGoal,
    contextUsageByAgentKey,
    values,
    messages: values.messages ?? [],
    historyMessageLoadVersion,
    historyMessagePagination,
    todos,
    runtimeActivities,
    pendingFollowUps,
    pendingRequestUserInput,
    pendingHITLRequest,
    isLoading,
    isReady,
    error,
    loadThread,
    loadConversationMessages,
    loadMoreConversationMessages,
    submit,
    stop,
    reset,
    removePendingFollowUp,
    canSendPendingFollowUpNow,
    sendPendingFollowUpNow,
    promotePendingFollowUpToSteer,
    submitRequestUserInput,
    submitHITLDecision,
    stopRuntimeActivityItem,
    setThreadId,
  };

  return (
    <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
  );
};

export const StreamProvider: React.FC<{
  children: ReactNode;
  apiKey?: string;
  organizationId?: string;
  apiUrl?: string;
  xpertId?: string;
  initialThread?: string | null;
  locale?: string | null;
}> = ({
  children,
  apiKey,
  organizationId,
  apiUrl,
  xpertId,
  initialThread,
  locale,
}) => {
  return (
    <StreamSession
      apiKey={apiKey ?? ''}
      organizationId={organizationId}
      apiUrl={apiUrl ?? defaultApiUrl}
      assistantId={xpertId ?? 'your-xpert-id'}
      initialThread={initialThread}
      locale={locale}
    >
      {children}
    </StreamSession>
  );
};

export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStreamContext must be used within a StreamProvider');
  }
  return context;
};

export default StreamContext;
