import type { ChatMessage } from '@xpert-ai/xpert-sdk';
import type {
  FollowUpBehavior,
  TChatRequest,
  TChatRequestHuman,
} from '@xpert-ai/chatkit-types';

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
  followUpMode: FollowUpBehavior;
  followUpStatus: 'consumed';
  targetExecutionId?: string | null;
  visibleAt?: string | null;
};

export function normalizeFollowUpBehavior(value: unknown): FollowUpBehavior | null {
  return value === 'queue' || value === 'steer' ? value : null;
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

export function extractRequestHumanInput(input?: TChatRequest | null): TChatRequestHuman | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as { input?: TChatRequestHuman };
  return raw.input ?? null;
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
  const text = humanInput?.input?.trim();
  if (!text) {
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

export function toQueuedSendRequest(request: TChatRequest): TChatRequest {
  return {
    id: request.id,
    input: request.input,
    ...(request.state ? { state: request.state } : {}),
    ...(request.agentKey ? { agentKey: request.agentKey } : {}),
    ...(request.projectId ? { projectId: request.projectId } : {}),
    ...(request.conversationId ? { conversationId: request.conversationId } : {}),
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
  return items
    .filter((item) => item.mode === 'queue')
    .map((item) => item.id);
}

export function getPendingSteerFollowUpIds(items: PendingFollowUp[]) {
  return items
    .filter((item) => item.mode === 'steer')
    .map((item) => item.id);
}

export function isHiddenPendingFollowUpMessage(message: PersistedChatMessage) {
  return message.followUpStatus === 'pending' && !message.visibleAt;
}

export function mapPersistedPendingFollowUp(message: PersistedChatMessage): PendingFollowUp | null {
  const persistedMeta =
    message.thirdPartyMessage && typeof message.thirdPartyMessage === 'object'
      ? (message.thirdPartyMessage as { followUpClientMessageId?: unknown })
      : null;
  const text =
    typeof message.content === 'string'
      ? message.content.trim()
      : '';
  const mode = message.followUpMode ?? 'queue';

  if (!text) {
    return null;
  }

  const clientMessageId =
    typeof persistedMeta?.followUpClientMessageId === 'string' &&
    persistedMeta.followUpClientMessageId.trim()
      ? persistedMeta.followUpClientMessageId.trim()
      : message.id ?? createMessageId();
  return {
    id: clientMessageId,
    clientMessageId,
    mode,
    request: {
      id: clientMessageId,
      input: {
        input: text,
      },
      ...(message.targetExecutionId ? { executionId: message.targetExecutionId } : {}),
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
  const text = input?.input?.trim();
  if (!text) {
    return null;
  }

  return {
    id: item.clientMessageId,
    type: 'human',
    content: text,
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

function findLatestAssistantMessage<T extends AssistantLikeMessage>(messages: T[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isAssistantLikeMessage(messages[index])) {
      return messages[index];
    }
  }
  return undefined;
}

export function buildSteerFollowUpRunInput<TMessage extends AssistantLikeMessage>(args: {
  request: TChatRequest;
  conversationId?: string | null;
  targetExecutionId?: string | null;
  messages?: TMessage[];
}): ExplicitFollowUpRunInput | null {
  const humanInput = extractRequestHumanInput(args.request);
  const text = humanInput?.input?.trim();
  const conversationId = args.conversationId?.trim();

  if (!conversationId || !humanInput || !text) {
    return null;
  }

  const latestAssistantMessage = findLatestAssistantMessage(args.messages ?? []);
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
