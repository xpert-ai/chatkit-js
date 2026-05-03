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
  type RuntimeCapabilitiesSelection,
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
  type LangGraphInterruptPayload,
  type RequestUserInputAnswer,
  type RequestUserInputToolArgs,
  type RequestUserInputQuestion,
  type RequestUserInputResult,
  type RequestUserInputResultPurpose,
  type TChatRequest,
  type ChatEventEnvelope,
  type TMessageContentComplex,
  type TMessageContentComponent,
  type TThreadContextUsageEvent,
} from '@xpert-ai/chatkit-types';
import { appendMessageContent } from '../lib/message';
import {
  normalizeClientSecretResult,
  type ResolvedClientSecret,
} from '../lib/client-secret';
import { createMissingApiConfigurationError } from '../lib/api-config';
import { normalizeRequestContextAndConfig } from '../lib/request-options';
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
  pendingFollowUpToUiMessage,
  readPersistedFollowUpBehavior,
  toQueuedSendRequest,
  type FollowUpStatus,
  type PendingFollowUp,
  writePersistedFollowUpBehavior,
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

type ChatKitAIMessage = Message & {
  executionId?: string;
  references?: ChatKitReference[];
  submittedInput?: string;
  referenceComposition?: ChatKitReferenceCompositionMode;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  followUpMode?: FollowUpBehavior;
  followUpStatus?: FollowUpStatus;
  targetExecutionId?: string | null;
  visibleAt?: string | null;
  clientToolCalls?: ToolCall[];
};

type ChatKitMessageContentPart = NonNullable<
  Exclude<ChatKitAIMessage['content'], string>
>[number];

export type StateType = { messages: ChatKitAIMessage[] };

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

export type StreamContextType = {
  client: Client<StateType>;
  apiUrl: string;
  assistantId: string;
  apiKey: string;
  organizationId?: string;
  threadId: string | null;
  contextUsageByAgentKey: ThreadContextUsageByAgentKey;
  values: StateType;
  messages: ChatKitAIMessage[];
  todos: TodoListSnapshot | null;
  runtimeActivities: RuntimeActivitiesState;
  pendingFollowUps: PendingFollowUp[];
  pendingRequestUserInput: PendingRequestUserInput | null;
  followUpBehavior: FollowUpBehavior;
  isLoading: boolean;
  isReady: boolean;
  error: unknown;
  loadThread: (threadId: string) => Promise<void>;
  loadConversationMessages: (recordId: string) => Promise<ChatKitAIMessage[]>;
  submit: (
    values?: TChatRequest | null,
    options?: StreamSubmitOptions,
  ) => Promise<void>;
  stop: () => void;
  reset: (
    newThreadId?: string | null,
    initialMessages?: ChatKitAIMessage[],
    options?: { suppressThreadChange?: boolean },
  ) => void;
  setFollowUpBehavior: (behavior: FollowUpBehavior) => void;
  removePendingFollowUp: (id: string) => void;
  canSendPendingFollowUpNow: (id: string) => boolean;
  sendPendingFollowUpNow: (id: string) => Promise<void>;
  promotePendingFollowUpToSteer: (id: string) => Promise<void>;
  submitRequestUserInput: (answers: RequestUserInputAnswer[]) => void;
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

const DEFAULT_HISTORY_LIMIT = 200;

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

  return {
    id: message.id ?? createMessageId(),
    type,
    content,
    ...(message.reasoning ? { reasoning: message.reasoning as any } : {}),
    ...(message.executionId ? { executionId: message.executionId } : {}),
    ...(references.length > 0 ? { references } : {}),
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

function sortMessagesByCreatedAt<T extends ChatMessage>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.createdAt ?? '');
    const bTime = Date.parse(b.createdAt ?? '');
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return -1;
    if (Number.isNaN(bTime)) return 1;
    return aTime - bTime;
  });
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
  const references = extractMessageReferences(raw);
  const submittedInput =
    extractSubmittedInput(raw) ??
    (type === 'human' && typeof content === 'string' ? content : undefined);
  const referenceComposition = extractReferenceComposition(raw);
  const runtimeCapabilities = extractRuntimeCapabilities(raw);
  const toolCalls = extractClientToolCalls(raw);

  return {
    id,
    type,
    content,
    executionId,
    ...(toolCalls ? { clientToolCalls: toolCalls } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(submittedInput !== undefined ? { submittedInput } : {}),
    ...(referenceComposition ? { referenceComposition } : {}),
    ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
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

function normalizeToolMessagesResponse(
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
    setValues((prev) => ({ ...prev, messages: normalizedMessages }));
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
            messages: normalizedMessages,
          }));
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
              nextMessages[lastAssistantIndex] = message;
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

        const followUpConsumedEvent = parseFollowUpConsumedEvent(payload.data);
        if (followUpConsumedEvent) {
          onFollowUpConsumed?.(followUpConsumedEvent);
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
}: {
  children: ReactNode;
  apiKey: string;
  organizationId?: string;
  apiUrl: string;
  assistantId: string;
  initialThread?: string | null;
}) => {
  const [threadId, setThreadId] = useQueryState('threadId');
  const [values, setValues] = useState<StateType>({ messages: [] });
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
  const [followUpBehavior, setFollowUpBehaviorState] =
    useState<FollowUpBehavior>(
      () =>
        readPersistedFollowUpBehavior(assistantId, organizationId) ?? 'queue',
    );
  const [contextUsageByAgentKey, setContextUsageByAgentKey] =
    useState<ThreadContextUsageByAgentKey>({});
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
  const lastStreamOptionsRef = useRef<
    Pick<
      StreamSubmitOptions,
      'streamMode' | 'streamSubgraphs' | 'streamResumable'
    >
  >({});
  const lastExecutionIdRef = useRef<string | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    return () => {
      clearPendingRequestUserInput(
        createAbortError('The user input request was cancelled.'),
      );
    };
  }, [clearPendingRequestUserInput]);

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
    setFollowUpBehaviorState(
      readPersistedFollowUpBehavior(assistantId, organizationId) ?? 'queue',
    );
  }, [assistantId, organizationId]);

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
    [apiUrl, fetchWithClientSecretRefresh],
  );
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
    }
  }, [clearPendingRequestUserInput, threadId]);

  const stop = useCallback(() => {
    const activeThreadId = threadId ?? null;
    const activeRunId = lastExecutionIdRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    clearPendingRequestUserInput(
      createAbortError('The user input request was cancelled.'),
    );
    setIsLoading(false);
    if (activeThreadId && activeRunId) {
      client.runs
        .cancel(activeThreadId, activeRunId, false)
        .catch(() => undefined);
    }
  }, [clearPendingRequestUserInput, client, threadId]);

  const addAutoQueuedFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
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
    setAutoQueuedFollowUpIds((prev) => prev.filter((id) => !idSet.has(id)));
  }, []);

  const removePendingFollowUps = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setPendingFollowUps((prev) => prev.filter((item) => !idSet.has(item.id)));
      removeAutoQueuedFollowUpIds(ids);
    },
    [removeAutoQueuedFollowUpIds],
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

  const setFollowUpBehavior = useCallback(
    (behavior: FollowUpBehavior) => {
      if (followUpBehavior === behavior) {
        return;
      }

      setFollowUpBehaviorState(behavior);
      writePersistedFollowUpBehavior(behavior, assistantId, organizationId);
    },
    [assistantId, followUpBehavior, organizationId],
  );

  const markPendingFollowUpsAsQueued = useCallback(
    (ids: string[], options?: { autoDrain?: boolean }) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setPendingFollowUps((prev) =>
        prev.map((item) =>
          idSet.has(item.id)
            ? {
                ...item,
                mode: 'queue' as const,
                request: {
                  ...item.request,
                  followUpMode: 'queue',
                },
              }
            : item,
        ),
      );
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
      clearRuntimeActivities();
      conversationIdRef.current = recordId;
      const response = await client.conversations.listMessages(recordId, {
        limit: DEFAULT_HISTORY_LIMIT,
        offset: 0,
      });
      const persistedMessages =
        (response.items as PersistedChatMessage[] | undefined) ?? [];
      const persistedPendingFollowUps = persistedMessages
        .filter((message) => isHiddenPendingFollowUpMessage(message))
        .map((message) => mapPersistedPendingFollowUp(message))
        .filter((item): item is PendingFollowUp => Boolean(item));
      setAutoQueuedFollowUpIds(
        getAutoDrainQueuedFollowUpIds(persistedPendingFollowUps),
      );
      setPendingFollowUps(persistedPendingFollowUps);
      const sorted = sortMessagesByCreatedAt(
        persistedMessages.filter(
          (message) => !isHiddenPendingFollowUpMessage(message),
        ),
      );
      const mapped = sorted.map(mapChatMessageToUiMessage);
      setValues({ messages: mapped ?? [] });
      return mapped as ChatKitAIMessage[];
    },
    [
      apiUrl,
      clearRuntimeActivities,
      client,
      runtimeClientSecret,
      stop,
      updateTodos,
    ],
  );

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
      setPendingFollowUps([]);
      setAutoQueuedFollowUpIds([]);
      updateTodos(null);
      clearRuntimeActivities();
      setContextUsageByAgentKey({});
      setValues({ messages: initialMessages ?? [] });
      conversationIdRef.current = null;
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
      clearPendingRequestUserInput,
      clearRuntimeActivities,
      setThreadId,
      threadId,
      updateTodos,
    ],
  );

  const handleInterrupt = useCallback(
    async (data: unknown) => {
      const requests = collectClientToolRequests(data);
      if (requests.length === 0) return;

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
    },
    [isParentAvailable, sendCommand, setError, waitForRequestUserInput],
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

      const activeThreadId = threadId ?? null;
      if (!activeThreadId) {
        return;
      }

      const currentItem = pendingFollowUpsRef.current.find(
        (item) => item.id === id && item.mode === 'queue',
      );
      if (!currentItem) {
        return;
      }
      removeAutoQueuedFollowUpIds([id]);

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

      setPendingFollowUps((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                mode: 'steer',
                request: nextRequest,
                targetExecutionId: targetExecutionId ?? null,
              }
            : item,
        ),
      );

      try {
        await sendSteerFollowUp(activeThreadId, nextRequest, {
          ...(currentItem.context ? { context: currentItem.context } : {}),
          ...(currentItem.config ? { config: currentItem.config } : {}),
        });
      } catch (followUpError) {
        setError(followUpError);
        markPendingFollowUpsAsQueued([id], { autoDrain: true });
        setPendingFollowUps((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  targetExecutionId: targetExecutionId ?? null,
                }
              : item,
          ),
        );
      }
    },
    [
      markPendingFollowUpsAsQueued,
      removeAutoQueuedFollowUpIds,
      sendSteerFollowUp,
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
        threadId: threadId ?? undefined,
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
          threadId: threadId ?? undefined,
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
      input?: TChatRequest | null,
      options?: StreamSubmitOptions,
      runId?: string,
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
        setIsLoading(false);
        shouldStartFreshAssistantMessageAfterSteerRef.current = false;
        const staleSteerIds = getPendingSteerFollowUpIds(
          pendingFollowUpsRef.current,
        );
        if (staleSteerIds.length > 0) {
          markPendingFollowUpsAsQueued(staleSteerIds, { autoDrain: true });
        }
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
      lastEventIdRef.current = null;

      const conversationResult = await client.conversations.search({
        where: { threadId: threadId },
        limit: 1,
      });

      const conversation = conversationResult.items?.[0];
      if (!conversation?.id) {
        conversationIdRef.current = null;
        setPendingFollowUps([]);
        setValues({ messages: [] });
        return;
      }

      conversationIdRef.current = conversation.id;
      await loadConversationMessages(conversation.id);
      await refreshSandboxServices({
        targetThreadId: threadId,
        force: true,
      });

      const status = String(conversation.status ?? '').toLowerCase();
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
      clearRuntimeActivities,
      refreshSandboxServices,
      setThreadId,
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
    async (input?: TChatRequest | null, options?: StreamSubmitOptions) => {
      setError(null);
      const followUpMode = isLoadingRef.current
        ? options?.followUpMode
        : undefined;
      if (input && followUpMode) {
        const pending = createPendingFollowUp(
          {
            ...input,
            id: input.id ?? createMessageId(),
            executionId:
              input.executionId ?? lastExecutionIdRef.current ?? undefined,
            followUpMode,
          },
          followUpMode,
          options,
        );

        if (!pending) {
          return;
        }

        setPendingFollowUps((prev) => {
          const remaining = prev.filter((item) => item.id !== pending.id);
          return [...remaining, pending];
        });
        if (followUpMode === 'queue') {
          addAutoQueuedFollowUpIds([pending.id]);
        }

        const activeThreadId = threadId ?? null;
        if (followUpMode === 'steer' && activeThreadId) {
          try {
            await sendSteerFollowUp(activeThreadId, pending.request, options);
          } catch (followUpError) {
            setError(followUpError);
            markPendingFollowUpsAsQueued([pending.id], { autoDrain: true });
          }
        }
        return;
      }

      const previousThreadId = threadId ?? null;
      lastStreamOptionsRef.current = {
        streamMode: options?.streamMode,
        streamSubgraphs: options?.streamSubgraphs,
        streamResumable: options?.streamResumable,
      };
      const shouldStartNewThread = options?.newThread === true;
      if (shouldStartNewThread) {
        setValues({ messages: [] });
        setContextUsageByAgentKey({});
        updateTodos(null);
        clearRuntimeActivities();
        lastExecutionIdRef.current = null;
        lastEventIdRef.current = null;
      }
      const optimistic = options?.optimisticValues;
      if (optimistic) {
        setValues((prev) => applyOptimisticValues(prev, optimistic));
      }

      let nextThreadId = threadId ?? null;
      const desiredThreadId = options?.threadId ?? null;
      if (shouldStartNewThread) {
        nextThreadId = null;
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

      await runStream(nextThreadId, input, options);
    },
    [
      client,
      addAutoQueuedFollowUpIds,
      markPendingFollowUpsAsQueued,
      runStream,
      clearRuntimeActivities,
      sendSteerFollowUp,
      setThreadId,
      threadId,
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
    contextUsageByAgentKey,
    values,
    messages: values.messages ?? [],
    todos,
    runtimeActivities,
    pendingFollowUps,
    pendingRequestUserInput,
    followUpBehavior,
    isLoading,
    isReady,
    error,
    loadThread,
    loadConversationMessages,
    submit,
    stop,
    reset,
    setFollowUpBehavior,
    removePendingFollowUp,
    canSendPendingFollowUpNow,
    sendPendingFollowUpNow,
    promotePendingFollowUpToSteer,
    submitRequestUserInput,
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
}> = ({ children, apiKey, organizationId, apiUrl, xpertId, initialThread }) => {
  return (
    <StreamSession
      apiKey={apiKey ?? ''}
      organizationId={organizationId}
      apiUrl={apiUrl ?? defaultApiUrl}
      assistantId={xpertId ?? 'your-xpert-id'}
      initialThread={initialThread}
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
