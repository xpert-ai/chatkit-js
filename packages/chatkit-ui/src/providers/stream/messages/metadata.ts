import type { Message } from '@langchain/core/messages';
import type { ToolCall } from '@langchain/core/messages/tool';
import type {
  ChatKitReference,
  ChatKitReferenceCompositionMode,
} from '@xpert-ai/chatkit-types';
import type {
  ChatMessageBranching,
  ChatMessageInputCheckpoint,
} from '@xpert-ai/xpert-sdk';
import {
  normalizeAgentRunInfo,
  type AgentRunInfo,
} from '../../../lib/agent-runs';
import { filterInternalMessageContentArtifacts } from '../../../lib/message';
import { readMessageBranching } from '../../../lib/message-branching';
import {
  extractClientToolCalls,
  extractMessageReferences,
  extractReferenceComposition,
  extractRuntimeCapabilities,
  extractSubmittedInput,
  isMessageMetadataContainer,
  normalizeMessageType,
  normalizeRoleToMessageType,
  type MessageMetadataContainer,
} from '../../../lib/message-metadata';
import type { RuntimeCapabilitiesSelection } from '../../../lib/runtime-capabilities';
import { normalizeTaskSummaryContribution } from '../../../lib/task-summary';
import { isThreadContextUsageRenderArtifact } from '../../../lib/thread-context-usage';
import { createMessageId } from '../../../lib/utils';
import { isRecord } from '../events/envelope';
import type {
  ChatKitAIMessage,
  ChatKitMessageContentPart,
  PersistedChatMessage,
} from '../types';

export function normalizeMessageFiles(
  value: unknown,
): Record<string, unknown>[] | undefined {
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

export function mapChatMessageToUiMessage(
  message: PersistedChatMessage,
): ChatKitAIMessage {
  const references = extractMessageReferences(message);
  const content = filterInternalMessageContentArtifacts(message.content ?? '');
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
  const taskSummary = normalizeTaskSummaryContribution(message.taskSummary);
  const agentRuns = Array.isArray(message.agentRuns)
    ? message.agentRuns
        .map((run) => normalizeAgentRunInfo(run))
        .filter((run): run is AgentRunInfo => Boolean(run))
    : [];

  return {
    id: message.id ?? createMessageId(),
    type,
    content,
    ...(typeof message.status === 'string' ? { status: message.status } : {}),
    ...(message.branching
      ? { branching: readMessageBranching(message.branching) }
      : {}),
    ...(message.historical ? { historical: true } : {}),
    ...(message.inputCheckpoint !== undefined
      ? { inputCheckpoint: message.inputCheckpoint }
      : {}),
    ...(message.reasoning ? { reasoning: message.reasoning as any } : {}),
    ...(message.executionId ? { executionId: message.executionId } : {}),
    ...(agentRuns.length ? { agentRuns } : {}),
    ...(message.createdAt ? { createdAt: message.createdAt } : {}),
    ...(message.updatedAt ? { updatedAt: message.updatedAt } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(attachments ? { attachments } : {}),
    ...(fileAssets ? { fileAssets } : {}),
    ...(submittedInput !== undefined ? { submittedInput } : {}),
    ...(typeof message.model === 'string' ? { model: message.model } : {}),
    ...(referenceComposition ? { referenceComposition } : {}),
    ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
    ...(taskSummary ? { taskSummary } : {}),
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

export function readInputCheckpoint(
  value: unknown,
): ChatMessageInputCheckpoint | null | undefined {
  if (value === null) return null;
  if (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1 &&
    'graphRevision' in value &&
    typeof value.graphRevision === 'string' &&
    'checkpoint' in value
  ) {
    return value as ChatMessageInputCheckpoint;
  }
  return undefined;
}

export function createMessageFromData(data: unknown): ChatKitAIMessage | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    return { id: createMessageId(), type: 'ai', content: data };
  }
  if (!isMessageMetadataContainer(data)) return null;
  if (isThreadContextUsageRenderArtifact(data)) return null;

  const raw = data;
  const content: ChatKitAIMessage['content'] = (() => {
    if ('content' in raw) {
      const rawContent = (raw as { content?: Message['content'] }).content;
      if (typeof rawContent === 'string' || Array.isArray(rawContent)) {
        return filterInternalMessageContentArtifacts(rawContent) ?? '';
      }
      if (rawContent == null) {
        return '';
      }
    }

    if ('text' in raw) {
      const textContent = (raw as { text?: Message['content'] }).text;
      if (typeof textContent === 'string' || Array.isArray(textContent)) {
        return filterInternalMessageContentArtifacts(textContent) ?? '';
      }
      if (textContent == null) {
        return '';
      }
    }

    return (
      filterInternalMessageContentArtifacts([
        raw as unknown as ChatKitMessageContentPart,
      ]) ?? []
    );
  })();
  const type =
    normalizeMessageType(raw.type) ?? normalizeMessageType(raw.role) ?? 'ai';
  const id = typeof raw.id === 'string' ? raw.id : createMessageId();
  const executionId =
    typeof raw.executionId === 'string' ? raw.executionId : undefined;
  const createdAt =
    typeof raw.createdAt === 'string' ? raw.createdAt : undefined;
  const updatedAt =
    typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined;
  const references = extractMessageReferences(raw);
  const submittedInput =
    extractSubmittedInput(raw) ??
    (type === 'human' && typeof content === 'string' ? content : undefined);
  const referenceComposition = extractReferenceComposition(raw);
  const runtimeCapabilities = extractRuntimeCapabilities(raw);
  const toolCalls = extractClientToolCalls(raw);
  const attachments = normalizeMessageFiles(
    (raw as { attachments?: unknown }).attachments,
  );
  const fileAssets = normalizeMessageFiles(
    (raw as { fileAssets?: unknown }).fileAssets,
  );
  const rawAgentRuns = (raw as { agentRuns?: unknown }).agentRuns;
  const agentRuns = Array.isArray(rawAgentRuns)
    ? rawAgentRuns
        .map((item) => normalizeAgentRunInfo(item))
        .filter((item): item is AgentRunInfo => Boolean(item))
    : [];
  const taskSummary = normalizeTaskSummaryContribution(
    (raw as { taskSummary?: unknown }).taskSummary,
  );
  const inputCheckpoint = readInputCheckpoint(
    (raw as { inputCheckpoint?: unknown }).inputCheckpoint,
  );
  const branching = readMessageBranching(
    'branching' in raw ? raw.branching : undefined,
  );

  return {
    id,
    type,
    content,
    executionId,
    ...(typeof raw.status === 'string' ? { status: raw.status } : {}),
    ...(inputCheckpoint !== undefined ? { inputCheckpoint } : {}),
    ...(branching ? { branching } : {}),
    ...('historical' in raw && raw.historical === true
      ? { historical: true }
      : {}),
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
    ...(taskSummary ? { taskSummary } : {}),
  };
}

export function extractMessageMeta(raw: MessageMetadataContainer) {
  const meta: {
    createdAt?: string;
    updatedAt?: string;
    status?: string;
    agentRuns?: AgentRunInfo[];
    branching?: ChatMessageBranching;
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
  if (typeof raw.createdAt === 'string') meta.createdAt = raw.createdAt;
  if (typeof raw.updatedAt === 'string') meta.updatedAt = raw.updatedAt;
  if (typeof raw.status === 'string') meta.status = raw.status;
  if ('agentRuns' in raw && Array.isArray(raw.agentRuns)) {
    meta.agentRuns = raw.agentRuns
      .map((run) => normalizeAgentRunInfo(run))
      .filter((run): run is AgentRunInfo => Boolean(run));
  }
  meta.branching = readMessageBranching(
    'branching' in raw ? raw.branching : undefined,
  );
  meta.type = normalizeMessageType(raw.type ?? raw.role);
  if ('content' in raw) {
    meta.content = filterInternalMessageContentArtifacts(
      (raw as { content?: Message['content'] }).content,
    );
  }
  const references = extractMessageReferences(raw);
  const submittedInput = extractSubmittedInput(raw);
  const referenceComposition = extractReferenceComposition(raw);
  const runtimeCapabilities = extractRuntimeCapabilities(raw);
  const attachments = normalizeMessageFiles(
    (raw as { attachments?: unknown }).attachments,
  );
  const fileAssets = normalizeMessageFiles(
    (raw as { fileAssets?: unknown }).fileAssets,
  );
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
