import {
  ChatMessageEventTypeEnum,
  type TMessageContentComplex,
} from '@xpert-ai/chatkit-types';

import { createMessageId } from './utils';

export type AgentRunInfo = {
  id: string;
  parentId?: string;
  parentExecutionId?: string;
  agentKey?: string;
  xpertName?: string;
  title?: string;
  status?: string;
  elapsedTime?: number;
  error?: unknown;
  inputs?: unknown;
  runId?: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  endedAt?: string;
};

export type AgentEventContent = TMessageContentComplex & {
  type: 'agent_event';
  event?: string;
  title?: string;
  message?: string;
  status?: string;
  error?: unknown;
  data?: unknown;
};

export function isAgentEventContent(
  content: TMessageContentComplex,
): content is AgentEventContent {
  return content.type === 'agent_event';
}

export function readContentExecutionId(
  content: TMessageContentComplex | string | undefined,
): string | undefined {
  if (!content || typeof content === 'string') return undefined;
  return typeof content.executionId === 'string' && content.executionId.trim()
    ? content.executionId.trim()
    : undefined;
}

export function readContentParentExecutionId(
  content: TMessageContentComplex | string | undefined,
): string | undefined {
  if (!content || typeof content === 'string') return undefined;
  return typeof content.parentExecutionId === 'string' &&
    content.parentExecutionId.trim()
    ? content.parentExecutionId.trim()
    : undefined;
}

export function readContentAgentKey(
  content: TMessageContentComplex | string | undefined,
): string | undefined {
  if (!content || typeof content === 'string') return undefined;
  return typeof content.agentKey === 'string' && content.agentKey.trim()
    ? content.agentKey.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readNestedName(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return (
    readTrimmedString(value.title) ?? readTrimmedString(value.name) ?? undefined
  );
}

export function normalizeAgentRunInfo(
  value: unknown,
  eventType?: ChatMessageEventTypeEnum,
): AgentRunInfo | null {
  if (!isRecord(value)) return null;

  const id = readTrimmedString(value.id);
  if (!id) return null;

  const parentId =
    readTrimmedString(value.parentId) ??
    readTrimmedString(value.parentExecutionId) ??
    undefined;
  const xpertName =
    readTrimmedString(value.xpertName) ??
    readNestedName(value.agent) ??
    readNestedName(value.xpert);
  const status =
    eventType === ChatMessageEventTypeEnum.ON_AGENT_START
      ? 'running'
      : (readTrimmedString(value.status) ?? undefined);
  const agentKey = readTrimmedString(value.agentKey);
  const title = readTrimmedString(value.title);
  const elapsedTime = readOptionalNumber(value.elapsedTime);
  const runId = readTrimmedString(value.runId);
  const createdAt = readTrimmedString(value.createdAt);
  const updatedAt = readTrimmedString(value.updatedAt);
  const startedAt = readTrimmedString(value.startedAt);
  const endedAt = readTrimmedString(value.endedAt);

  return {
    id,
    ...(parentId ? { parentId, parentExecutionId: parentId } : {}),
    ...(agentKey ? { agentKey } : {}),
    ...(xpertName ? { xpertName } : {}),
    ...(title ? { title } : {}),
    ...(status ? { status } : {}),
    ...(elapsedTime !== undefined ? { elapsedTime } : {}),
    ...(value.error !== undefined ? { error: value.error } : {}),
    ...(value.inputs !== undefined ? { inputs: value.inputs } : {}),
    ...(runId ? { runId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
  };
}

export function mergeAgentRunInfo(
  previous: AgentRunInfo | undefined,
  incoming: AgentRunInfo,
): AgentRunInfo {
  if (!previous) return incoming;

  return {
    ...previous,
    ...incoming,
    id: previous.id || incoming.id,
    parentId: incoming.parentId ?? previous.parentId,
    parentExecutionId: incoming.parentExecutionId ?? previous.parentExecutionId,
    agentKey: incoming.agentKey ?? previous.agentKey,
    xpertName: incoming.xpertName ?? previous.xpertName,
    title: incoming.title ?? previous.title,
    status: incoming.status ?? previous.status,
    elapsedTime: incoming.elapsedTime ?? previous.elapsedTime,
    error: incoming.error ?? previous.error,
    inputs: incoming.inputs ?? previous.inputs,
  };
}

export function upsertAgentRun(
  existing: AgentRunInfo[] | undefined,
  incoming: AgentRunInfo,
) {
  const runs = existing ? [...existing] : [];
  const index = runs.findIndex((run) => run.id === incoming.id);
  if (index >= 0) {
    runs[index] = mergeAgentRunInfo(runs[index], incoming);
    return runs;
  }

  runs.push(incoming);
  return runs;
}

export function createAgentEventContent(
  data: unknown,
): AgentEventContent | null {
  if (!isRecord(data)) return null;

  const executionId = readTrimmedString(data.executionId);
  if (!executionId) return null;

  const parentExecutionId =
    readTrimmedString(data.parentExecutionId) ??
    readTrimmedString(data.parentId) ??
    undefined;
  const id =
    readTrimmedString(data.eventId) ??
    readTrimmedString(data.id) ??
    createMessageId();
  const agentKey = readTrimmedString(data.agentKey) ?? undefined;
  const xpertName = readTrimmedString(data.xpertName) ?? undefined;
  const runId = readTrimmedString(data.runId) ?? undefined;
  const createdDate =
    readTrimmedString(data.created_date) ??
    readTrimmedString(data.createdAt) ??
    new Date().toISOString();

  return {
    id,
    type: 'agent_event',
    event:
      readTrimmedString(data.type) ??
      readTrimmedString(data.event) ??
      readTrimmedString(data.name) ??
      undefined,
    title: readTrimmedString(data.title) ?? undefined,
    message: readTrimmedString(data.message) ?? undefined,
    status: readTrimmedString(data.status) ?? undefined,
    ...(data.error !== undefined ? { error: data.error } : {}),
    data,
    executionId,
    ...(parentExecutionId ? { parentExecutionId } : {}),
    ...(agentKey ? { agentKey } : {}),
    ...(xpertName ? { xpertName } : {}),
    ...(runId ? { runId } : {}),
    created_date: createdDate,
  };
}
