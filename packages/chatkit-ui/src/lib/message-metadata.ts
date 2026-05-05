import type { Message } from '@langchain/core/messages';
import type { ToolCall } from '@langchain/core/messages/tool';
import type { RuntimeCapabilitiesSelection } from '@xpert-ai/xpert-sdk';
import {
  isClientToolRequest,
  type ChatKitReference,
  type ChatKitReferenceCompositionMode,
} from '@xpert-ai/chatkit-types';

import { normalizeReferences } from './references';

export type MessageMetadataContainer = Record<string, unknown> & {
  references?: unknown;
  input?: unknown;
  metadata?: unknown;
  state?: unknown;
  human?: unknown;
  submittedInput?: unknown;
  referenceComposition?: unknown;
  runtimeCapabilities?: unknown;
  type?: unknown;
  role?: unknown;
  content?: unknown;
  text?: unknown;
  messages?: unknown;
  id?: unknown;
  executionId?: unknown;
  execution_id?: unknown;
};

export function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isMessageMetadataContainer(
  value: unknown,
): value is MessageMetadataContainer {
  return isObjectRecord(value);
}

function toMessageMetadataContainer(
  value: unknown,
): MessageMetadataContainer | null {
  return isMessageMetadataContainer(value) ? value : null;
}

function getHumanMetadataContainer(
  value: MessageMetadataContainer,
): MessageMetadataContainer | null {
  const state = toMessageMetadataContainer(value.state);
  return toMessageMetadataContainer(state?.human);
}

function getNestedReferenceCandidate(value: unknown): unknown {
  return toMessageMetadataContainer(value)?.references;
}

function getNestedInputCandidate(value: unknown): unknown {
  return toMessageMetadataContainer(value)?.input;
}

function getNestedReferenceCompositionCandidate(value: unknown): unknown {
  return toMessageMetadataContainer(value)?.referenceComposition;
}

function getNestedRuntimeCapabilitiesCandidate(value: unknown): unknown {
  return toMessageMetadataContainer(value)?.runtimeCapabilities;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isSkillSelection(
  value: unknown,
): value is RuntimeCapabilitiesSelection['skills'] {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    isStringArray(value.ids) &&
    (value.workspaceId === undefined || typeof value.workspaceId === 'string')
  );
}

function isNodeKeySelection(value: unknown): value is { nodeKeys: string[] } {
  return isObjectRecord(value) && isStringArray(value.nodeKeys);
}

export function isRuntimeCapabilitiesSelection(
  value: unknown,
): value is RuntimeCapabilitiesSelection {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    value.mode === 'allowlist' &&
    isSkillSelection(value.skills) &&
    isNodeKeySelection(value.plugins) &&
    (value.subAgents === undefined || isNodeKeySelection(value.subAgents))
  );
}

export function normalizeRoleToMessageType(role?: string): Message['type'] {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'user' || normalized === 'human') return 'human';
  if (normalized === 'assistant' || normalized === 'ai') return 'ai';
  if (normalized === 'system') return 'system';
  if (normalized === 'tool') return 'tool';
  return 'ai';
}

export function normalizeMessageType(
  value: unknown,
): Message['type'] | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value.toLowerCase();
  switch (normalized) {
    case 'user':
    case 'human':
      return 'human';
    case 'assistant':
    case 'ai':
      return 'ai';
    case 'system':
      return 'system';
    case 'tool':
      return 'tool';
    default:
      return value as Message['type'];
  }
}

export function extractMessageReferences(
  value: MessageMetadataContainer,
): ChatKitReference[] {
  const candidates = [
    value.references,
    getNestedReferenceCandidate(value.input),
    getNestedReferenceCandidate(value.metadata),
    getNestedReferenceCandidate(getHumanMetadataContainer(value)),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeReferences(candidate);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

export function extractSubmittedInput(
  value: MessageMetadataContainer,
): string | undefined {
  if (typeof value.submittedInput === 'string') {
    return value.submittedInput;
  }

  const human = getHumanMetadataContainer(value);
  const candidates = [
    value.input,
    getNestedInputCandidate(value.input),
    getNestedInputCandidate(value.metadata),
    human?.input,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return undefined;
}

export function extractReferenceComposition(
  value: MessageMetadataContainer,
): ChatKitReferenceCompositionMode | undefined {
  if (
    value.referenceComposition === 'compose' ||
    value.referenceComposition === 'preserve'
  ) {
    return value.referenceComposition;
  }

  const human = getHumanMetadataContainer(value);
  const candidates = [
    getNestedReferenceCompositionCandidate(value.input),
    getNestedReferenceCompositionCandidate(value.metadata),
    human?.referenceComposition,
  ];

  for (const candidate of candidates) {
    if (candidate === 'compose' || candidate === 'preserve') {
      return candidate;
    }
  }

  return undefined;
}

export function extractRuntimeCapabilities(
  value: MessageMetadataContainer,
): RuntimeCapabilitiesSelection | undefined {
  const human = getHumanMetadataContainer(value);
  const candidates = [
    value.runtimeCapabilities,
    getNestedRuntimeCapabilitiesCandidate(value.input),
    getNestedRuntimeCapabilitiesCandidate(value.metadata),
    human?.runtimeCapabilities,
  ];

  return candidates.find(isRuntimeCapabilitiesSelection);
}

export function extractClientToolCalls(
  value: MessageMetadataContainer,
): ToolCall[] | undefined {
  if (!isClientToolRequest(value) || value.clientToolCalls.length === 0) {
    return undefined;
  }

  return value.clientToolCalls;
}

export function extractMessageExecutionId(
  value: MessageMetadataContainer,
): string | undefined {
  const executionId = value.executionId ?? value.execution_id;
  return typeof executionId === 'string' ? executionId : undefined;
}
