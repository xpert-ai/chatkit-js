import type { ChatMessage } from '@xpert-ai/xpert-sdk';
import type {
  ChatKitReference,
  ChatKitReferenceCompositionMode,
  FollowUpBehavior,
  TChatRequest,
  TChatRequestHuman,
} from '@xpert-ai/chatkit-types';

import { normalizeReferences } from './references';
import { createMessageId } from './utils';

export type FollowUpStatus = 'pending' | 'consumed' | 'canceled';

export type ExplicitFollowUpRunInput = {
  action: 'follow_up';
  conversationId: string;
  mode: FollowUpBehavior;
  message: {
    clientMessageId?: string;
    input: TChatRequestHuman;
  };
  target?: {
    aiMessageId?: string;
    executionId?: string;
  };
  state?: Record<string, unknown>;
};

export type PendingFollowUp = {
  id: string;
  clientMessageId: string;
  mode: FollowUpBehavior;
  request: TChatRequest;
  context?: Record<string, unknown>;
  config?: Record<string, unknown>;
  targetExecutionId?: string | null;
  transcriptInserted?: boolean;
  createdAt: number;
};

const FOLLOW_UP_BEHAVIOR_STORAGE_PREFIX = 'xpert:chatkit:follow-up-behavior';

type PersistedChatMessage = ChatMessage & {
  references?: unknown;
  input?: unknown;
  metadata?: unknown;
  state?: unknown;
  submittedInput?: unknown;
  referenceComposition?: unknown;
  followUpMode?: FollowUpBehavior;
  followUpStatus?: FollowUpStatus;
  targetExecutionId?: string | null;
  visibleAt?: string | null;
  thirdPartyMessage?: unknown;
};

type AssistantLikeMessage = {
  id?: string;
  type?: string;
};

type FollowUpUiMessage = {
  id: string;
  type: 'human';
  content: string;
  references?: ChatKitReference[];
  submittedInput?: string;
  referenceComposition?: ChatKitReferenceCompositionMode;
  followUpMode: FollowUpBehavior;
  followUpStatus: 'consumed';
  targetExecutionId?: string | null;
  visibleAt?: string | null;
};

type ReferencePayloadContainer = {
  references?: unknown;
  input?: unknown;
  metadata?: unknown;
  state?: unknown;
  submittedInput?: unknown;
  referenceComposition?: unknown;
};

type ReferenceStateContainer = {
  human?: unknown;
};

export type MergedQueuedFollowUpGroup = {
  items: PendingFollowUp[];
  request: TChatRequest;
  context?: Record<string, unknown>;
  config?: Record<string, unknown>;
  targetExecutionId?: string | null;
};

export function normalizeFollowUpBehavior(
  value: unknown,
): FollowUpBehavior | null {
  return value === 'queue' || value === 'steer' ? value : null;
}

export function getComposerFollowUpShortcutLabels(
  queueShortcutLabel: string,
): Record<FollowUpBehavior, string> {
  return {
    steer: 'Enter',
    queue: queueShortcutLabel,
  };
}

export function getBusyComposerShortcutFollowUpMode(
  useQueueShortcut: boolean,
): FollowUpBehavior {
  return useQueueShortcut ? 'queue' : 'steer';
}

export function getFollowUpBehaviorStorageKey(
  assistantId?: string | null,
  organizationId?: string | null,
) {
  const normalizedAssistantId = assistantId?.trim();
  if (!normalizedAssistantId) {
    return null;
  }

  return `${FOLLOW_UP_BEHAVIOR_STORAGE_PREFIX}:${normalizedAssistantId}:${organizationId?.trim() || 'default'}`;
}

export function readPersistedFollowUpBehavior(
  assistantId?: string | null,
  organizationId?: string | null,
) {
  if (typeof window === 'undefined') {
    return null;
  }

  const storageKey = getFollowUpBehaviorStorageKey(assistantId, organizationId);
  if (!storageKey) {
    return null;
  }

  try {
    return normalizeFollowUpBehavior(window.localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

export function writePersistedFollowUpBehavior(
  behavior: FollowUpBehavior,
  assistantId?: string | null,
  organizationId?: string | null,
) {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getFollowUpBehaviorStorageKey(assistantId, organizationId);
  if (!storageKey) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, behavior);
  } catch {
    // Ignore localStorage failures for embedded or restricted environments.
  }
}

export function extractRequestHumanInput(
  input?: TChatRequest | null,
): TChatRequestHuman | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as { input?: TChatRequestHuman };
  return raw.input ?? null;
}

function isReferencePayloadContainer(
  value: unknown,
): value is ReferencePayloadContainer {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getNestedReferenceCandidate(value: unknown): unknown {
  return isReferencePayloadContainer(value) ? value.references : undefined;
}

function getNestedInputCandidate(value: unknown): unknown {
  return isReferencePayloadContainer(value) ? value.input : undefined;
}

function extractPersistedReferences(value: unknown): ChatKitReference[] {
  const direct = normalizeReferences(value);
  if (direct.length > 0) {
    return direct;
  }

  if (!isReferencePayloadContainer(value)) {
    return [];
  }

  const state = isReferencePayloadContainer(value.state)
    ? (value.state as ReferenceStateContainer)
    : null;

  const candidates = [
    value.references,
    getNestedReferenceCandidate(value.input),
    getNestedReferenceCandidate(value.metadata),
    getNestedReferenceCandidate(state?.human),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeReferences(candidate);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function extractPersistedSubmittedInput(value: unknown): string | undefined {
  if (!isReferencePayloadContainer(value)) {
    return undefined;
  }

  if (typeof value.submittedInput === 'string') {
    return value.submittedInput;
  }

  const state = isReferencePayloadContainer(value.state)
    ? (value.state as ReferenceStateContainer)
    : null;

  const candidates = [
    value.input,
    getNestedInputCandidate(value.input),
    getNestedInputCandidate(value.metadata),
    isReferencePayloadContainer(state?.human) ? state.human.input : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return undefined;
}

function extractPersistedReferenceComposition(
  value: unknown,
): ChatKitReferenceCompositionMode | undefined {
  if (!isReferencePayloadContainer(value)) {
    return undefined;
  }

  if (
    value.referenceComposition === 'compose' ||
    value.referenceComposition === 'preserve'
  ) {
    return value.referenceComposition;
  }

  const state = isReferencePayloadContainer(value.state)
    ? (value.state as ReferenceStateContainer)
    : null;

  const candidates = [
    isReferencePayloadContainer(value.input)
      ? value.input.referenceComposition
      : undefined,
    isReferencePayloadContainer(value.metadata)
      ? value.metadata.referenceComposition
      : undefined,
    isReferencePayloadContainer(state?.human)
      ? state.human.referenceComposition
      : undefined,
  ];

  for (const candidate of candidates) {
    if (candidate === 'compose' || candidate === 'preserve') {
      return candidate;
    }
  }

  return undefined;
}

function hasSubmittableHumanInput(humanInput?: TChatRequestHuman | null) {
  if (!humanInput) {
    return false;
  }

  const text =
    typeof humanInput.input === 'string' ? humanInput.input.trim() : '';
  const references = normalizeReferences(humanInput.references);

  return Boolean(text) || references.length > 0;
}

function mergeInputText(
  previousInput: unknown,
  nextInput: unknown,
): string | undefined {
  const segments = [previousInput, nextInput].filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );

  return segments.length ? segments.join('\n\n') : undefined;
}

function mergeArrayValues<T>(
  previousValue: unknown,
  nextValue: unknown,
): T[] | undefined {
  const merged = [
    ...(Array.isArray(previousValue) ? (previousValue as T[]) : []),
    ...(Array.isArray(nextValue) ? (nextValue as T[]) : []),
  ];

  return merged.length ? merged : undefined;
}

function normalizeTargetExecutionId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function sortPendingFollowUps(items: PendingFollowUp[]) {
  return [...items].sort((left, right) => left.createdAt - right.createdAt);
}

export function mergeFollowUpHumanInputs(
  inputs: Array<TChatRequestHuman | null | undefined>,
): TChatRequestHuman {
  return inputs.reduce<TChatRequestHuman>((acc, item) => {
    const nextInput = item ?? {};
    const { input, files, references, ...rest } = nextInput;
    const next: TChatRequestHuman = {
      ...acc,
      ...rest,
    };
    const mergedInput = mergeInputText(acc.input, input);
    const mergedFiles = mergeArrayValues<Partial<File>>(acc.files, files);
    const mergedReferences = mergeArrayValues<ChatKitReference>(
      acc.references,
      references,
    );

    if (mergedInput) {
      next.input = mergedInput;
    } else {
      delete next.input;
    }

    if (mergedFiles?.length) {
      next.files = mergedFiles;
    } else {
      delete next.files;
    }

    if (mergedReferences?.length) {
      next.references = mergedReferences;
    } else {
      delete next.references;
    }

    return next;
  }, {});
}

export function createPendingFollowUp(
  request: TChatRequest,
  mode: FollowUpBehavior,
  options?: {
    context?: Record<string, unknown>;
    config?: Record<string, unknown>;
  },
): PendingFollowUp | null {
  const humanInput = extractRequestHumanInput(request);
  if (!hasSubmittableHumanInput(humanInput)) {
    return null;
  }

  const clientMessageId = request.id ?? createMessageId();

  return {
    id: clientMessageId,
    clientMessageId,
    mode,
    request: {
      ...request,
      id: clientMessageId,
      followUpMode: mode,
    },
    ...(options?.context ? { context: options.context } : {}),
    ...(options?.config ? { config: options.config } : {}),
    targetExecutionId: request.executionId ?? null,
    createdAt: Date.now(),
  };
}

export function resolvePendingFollowUpTargetExecutionId(
  item: PendingFollowUp | null | undefined,
) {
  if (!item) {
    return null;
  }

  return normalizeTargetExecutionId(
    item.targetExecutionId ?? item.request.executionId,
  );
}

export function getQueuedFollowUpGroup(
  items: PendingFollowUp[],
  targetItem: PendingFollowUp | null | undefined,
) {
  if (!targetItem || targetItem.mode !== 'queue') {
    return [];
  }

  const sortedQueueItems = sortPendingFollowUps(
    items.filter((item) => item.mode === 'queue'),
  );
  const targetExecutionId = resolvePendingFollowUpTargetExecutionId(targetItem);

  if (!targetExecutionId) {
    return sortedQueueItems.filter((item) => item.id === targetItem.id);
  }

  return sortedQueueItems.filter(
    (item) =>
      resolvePendingFollowUpTargetExecutionId(item) === targetExecutionId,
  );
}

export function mergeQueuedFollowUpGroup(
  items: PendingFollowUp[],
  options?: {
    leadItemId?: string | null;
  },
): MergedQueuedFollowUpGroup | null {
  const groupedItems = sortPendingFollowUps(items);
  if (groupedItems.length === 0) {
    return null;
  }

  const leadItem =
    groupedItems.find((item) => item.id === options?.leadItemId) ??
    groupedItems[0];
  const latestRequest = groupedItems.reduce<TChatRequest>(
    (acc, item) => ({
      ...acc,
      ...item.request,
    }),
    leadItem.request,
  );
  const mergedHumanInput = mergeFollowUpHumanInputs(
    groupedItems.map((item) => extractRequestHumanInput(item.request)),
  );
  const {
    executionId: latestExecutionIdValue,
    ...latestRequestWithoutExecutionId
  } = latestRequest;
  const latestExecutionId = normalizeTargetExecutionId(latestExecutionIdValue);
  const targetExecutionId = resolvePendingFollowUpTargetExecutionId(leadItem);

  let context: Record<string, unknown> | undefined;
  let config: Record<string, unknown> | undefined;
  for (const item of groupedItems) {
    if (item.context) {
      context = item.context;
    }
    if (item.config) {
      config = item.config;
    }
  }

  return {
    items: groupedItems,
    request: {
      ...latestRequestWithoutExecutionId,
      id: leadItem.request.id ?? leadItem.id,
      input: mergedHumanInput,
      followUpMode: 'queue',
      ...(targetExecutionId
        ? { executionId: targetExecutionId }
        : latestExecutionId
          ? { executionId: latestExecutionId }
          : {}),
    },
    ...(context ? { context } : {}),
    ...(config ? { config } : {}),
    targetExecutionId,
  };
}

export function toQueuedSendRequest(request: TChatRequest): TChatRequest {
  return {
    id: request.id,
    input: request.input,
    ...(request.state ? { state: request.state } : {}),
    ...(request.agentKey ? { agentKey: request.agentKey } : {}),
    ...(request.projectId ? { projectId: request.projectId } : {}),
    ...(request.conversationId
      ? { conversationId: request.conversationId }
      : {}),
    ...(request.environmentId ? { environmentId: request.environmentId } : {}),
    ...(request.sandboxEnvironmentId
      ? { sandboxEnvironmentId: request.sandboxEnvironmentId }
      : {}),
  };
}

export function getNextAutoQueuedFollowUp(
  items: PendingFollowUp[],
  autoQueuedIds: Iterable<string>,
) {
  const autoQueuedIdSet = new Set(autoQueuedIds);
  return [...items]
    .filter((item) => item.mode === 'queue' && autoQueuedIdSet.has(item.id))
    .sort((a, b) => a.createdAt - b.createdAt)[0];
}

export function getAutoDrainQueuedFollowUpIds(items: PendingFollowUp[]) {
  return items.filter((item) => item.mode === 'queue').map((item) => item.id);
}

export function getPendingSteerFollowUpIds(items: PendingFollowUp[]) {
  return items.filter((item) => item.mode === 'steer').map((item) => item.id);
}

export function isHiddenPendingFollowUpMessage(message: PersistedChatMessage) {
  return message.followUpStatus === 'pending' && !message.visibleAt;
}

export function mapPersistedPendingFollowUp(
  message: PersistedChatMessage,
): PendingFollowUp | null {
  const persistedMeta =
    message.thirdPartyMessage && typeof message.thirdPartyMessage === 'object'
      ? (message.thirdPartyMessage as { followUpClientMessageId?: unknown })
      : null;
  const text =
    typeof message.content === 'string' ? message.content.trim() : '';
  const references = extractPersistedReferences(message);
  const submittedInput = extractPersistedSubmittedInput(message);
  const referenceComposition = extractPersistedReferenceComposition(message);
  const mode = message.followUpMode ?? 'queue';

  if (!text && references.length === 0) {
    return null;
  }

  const clientMessageId =
    typeof persistedMeta?.followUpClientMessageId === 'string' &&
    persistedMeta.followUpClientMessageId.trim()
      ? persistedMeta.followUpClientMessageId.trim()
      : (message.id ?? createMessageId());
  return {
    id: clientMessageId,
    clientMessageId,
    mode,
    request: {
      id: clientMessageId,
      input: {
        input: submittedInput ?? text,
        ...(references.length > 0 ? { references } : {}),
        ...(referenceComposition ? { referenceComposition } : {}),
      },
      ...(message.targetExecutionId
        ? { executionId: message.targetExecutionId }
        : {}),
      followUpMode: mode,
    },
    targetExecutionId: message.targetExecutionId ?? null,
    createdAt: Date.parse(message.createdAt ?? '') || Date.now(),
  };
}

export function pendingFollowUpToUiMessage(
  item: PendingFollowUp,
  visibleAt?: string | null,
): FollowUpUiMessage | null {
  const input = extractRequestHumanInput(item.request);
  const text = typeof input?.input === 'string' ? input.input.trim() : '';
  const references = normalizeReferences(input?.references);
  if (!text && references.length === 0) {
    return null;
  }

  return {
    id: item.clientMessageId,
    type: 'human',
    content: text,
    ...(references.length > 0 ? { references } : {}),
    ...(typeof input?.input === 'string'
      ? { submittedInput: input.input }
      : {}),
    ...(input?.referenceComposition
      ? { referenceComposition: input.referenceComposition }
      : {}),
    followUpMode: item.mode,
    followUpStatus: 'consumed',
    targetExecutionId: item.targetExecutionId ?? null,
    visibleAt: visibleAt ?? new Date().toISOString(),
  };
}

function isAssistantLikeMessage(message: AssistantLikeMessage | undefined) {
  return (
    message?.type === 'ai' ||
    (typeof message?.type === 'string' &&
      message.type.toLowerCase() === 'assistant')
  );
}

function findLatestAssistantMessage<T extends AssistantLikeMessage>(
  messages: T[],
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isAssistantLikeMessage(messages[index])) {
      return messages[index];
    }
  }
  return undefined;
}

export function buildSteerFollowUpRunInput<
  TMessage extends AssistantLikeMessage,
>(args: {
  request: TChatRequest;
  conversationId?: string | null;
  targetExecutionId?: string | null;
  messages?: TMessage[];
}): ExplicitFollowUpRunInput | null {
  const humanInput = extractRequestHumanInput(args.request);
  const conversationId = args.conversationId?.trim();

  if (!conversationId || !humanInput || !hasSubmittableHumanInput(humanInput)) {
    return null;
  }

  const latestAssistantMessage = findLatestAssistantMessage(
    args.messages ?? [],
  );
  const aiMessageId =
    typeof latestAssistantMessage?.id === 'string' &&
    latestAssistantMessage.id.trim()
      ? latestAssistantMessage.id.trim()
      : undefined;
  const executionId =
    args.targetExecutionId?.trim() ||
    (typeof args.request.executionId === 'string' &&
    args.request.executionId.trim()
      ? args.request.executionId.trim()
      : undefined);

  const target =
    aiMessageId || executionId
      ? {
          ...(aiMessageId ? { aiMessageId } : {}),
          ...(executionId ? { executionId } : {}),
        }
      : undefined;

  return {
    action: 'follow_up',
    conversationId,
    mode: 'steer',
    message: {
      ...(args.request.id ? { clientMessageId: args.request.id } : {}),
      input: humanInput,
    },
    ...(target ? { target } : {}),
    ...(args.request.state ? { state: args.request.state } : {}),
  };
}
