import type {
  ChatkitMessage,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageContentReasoning,
  TMessageContentText,
} from '@xpert-ai/chatkit-types';

import {
  isAgentEventContent,
  isMiddlewareAgentRunInfo,
  readContentAgentKey,
  readContentExecutionId,
  readContentParentExecutionId,
  type AgentRunInfo,
} from './agent-runs';
import { isThreadContextUsageRenderArtifact } from './thread-context-usage';

export type AssistantMessageWithAgentRuns = ChatkitMessage & {
  executionId?: string;
  agentRuns?: AgentRunInfo[];
};

export type AssistantContentEntry = {
  item: TMessageContentComplex | string;
  index: number;
  source: 'content' | 'reasoning';
  order: number;
};

export type AgentRunRenderNode = {
  id: string;
  info: AgentRunInfo;
  entries: AssistantContentEntry[];
  children: AgentRunRenderNode[];
  firstOrder: number;
};

export type AssistantRenderUnit =
  | {
      type: 'entry';
      entry: AssistantContentEntry;
      order: number;
    }
  | {
      type: 'agent';
      node: AgentRunRenderNode;
      order: number;
    };

function isTextContent(
  content: TMessageContentComplex,
): content is TMessageContentText {
  return content.type === 'text';
}

function isReasoningContent(
  content: TMessageContentComplex,
): content is TMessageContentReasoning {
  return content.type === 'reasoning';
}

function isComponentContent(
  content: TMessageContentComplex,
): content is TMessageContentComponent {
  return content.type === 'component';
}

function parseDateValue(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function readContentTitle(content: TMessageContentComplex | string) {
  if (typeof content === 'string') return undefined;

  if (typeof content.xpertName === 'string' && content.xpertName.trim()) {
    return content.xpertName.trim();
  }

  return undefined;
}

function readContentStringField(
  content: TMessageContentComplex | string,
  field: 'xpertName' | 'agentKey' | 'runId',
) {
  if (typeof content === 'string') return undefined;
  const value = content[field];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeRunStatus(status?: string | null) {
  return typeof status === 'string' && status.trim()
    ? status.trim().toLowerCase()
    : 'pending';
}

export function isRunningRunStatus(status?: string | null) {
  return normalizeRunStatus(status) === 'running';
}

export function isFailedRunStatus(status?: string | null) {
  const normalized = normalizeRunStatus(status);
  return (
    normalized === 'error' || normalized === 'fail' || normalized === 'failed'
  );
}

export function hasVisibleAgentRunDetails(info: AgentRunInfo) {
  return info.error !== undefined;
}

export function getAgentRunTitle(info: AgentRunInfo, fallback?: string) {
  return (
    info.title?.trim() ||
    info.xpertName?.trim() ||
    info.agentKey?.trim() ||
    fallback ||
    null
  );
}

export function getAgentRunDuration(info: AgentRunInfo, now?: number) {
  if (
    typeof info.elapsedTime === 'number' &&
    Number.isFinite(info.elapsedTime)
  ) {
    return info.elapsedTime;
  }

  const startedAt =
    parseDateValue(info.startedAt) ?? parseDateValue(info.createdAt);
  if (startedAt === null) return null;

  if (isRunningRunStatus(info.status)) {
    return typeof now === 'number' && Number.isFinite(now)
      ? Math.max(0, now - startedAt)
      : null;
  }

  const endedAt = parseDateValue(info.endedAt) ?? parseDateValue(info.updatedAt);
  if (endedAt === null) return null;
  return Math.max(0, endedAt - startedAt);
}

export function getAgentRunCounts(node: AgentRunRenderNode) {
  let text = 0;
  let tools = 0;
  let events = 0;

  for (const entry of node.entries) {
    const item = entry.item;
    if (typeof item === 'string') {
      if (item.trim()) text += 1;
      continue;
    }

    if (isThreadContextUsageRenderArtifact(item)) {
      continue;
    }

    if (isTextContent(item) || isReasoningContent(item)) {
      if (item.text?.trim()) text += 1;
      continue;
    }

    if (isComponentContent(item)) {
      tools += 1;
      continue;
    }

    if (isAgentEventContent(item)) {
      events += 1;
    }
  }

  return {
    text,
    tools,
    events,
    children: node.children.length,
  };
}

function createAgentRunNode(
  nodes: Map<string, AgentRunRenderNode>,
  id: string,
  info: AgentRunInfo,
  order: number,
) {
  const existing = nodes.get(id);
  if (existing) {
    existing.info = {
      ...existing.info,
      ...info,
      id,
      parentId: info.parentId ?? existing.info.parentId,
      parentExecutionId:
        info.parentExecutionId ?? existing.info.parentExecutionId,
      agentKey: info.agentKey ?? existing.info.agentKey,
      xpertName: info.xpertName ?? existing.info.xpertName,
      title: info.title ?? existing.info.title,
      status: info.status ?? existing.info.status,
      elapsedTime: info.elapsedTime ?? existing.info.elapsedTime,
      error: info.error ?? existing.info.error,
      inputs: info.inputs ?? existing.info.inputs,
    };
    existing.firstOrder = Math.min(existing.firstOrder, order);
    return existing;
  }

  const node: AgentRunRenderNode = {
    id,
    info: { ...info, id },
    entries: [],
    children: [],
    firstOrder: order,
  };
  nodes.set(id, node);
  return node;
}

function findFallbackRunByAgentKey(
  runs: AgentRunInfo[],
  agentKey: string | undefined,
  rootExecutionId?: string,
) {
  if (!agentKey) return null;
  const candidates = runs.filter(
    (run) => run.agentKey === agentKey && run.id !== rootExecutionId,
  );
  if (candidates.length === 0) return null;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (isRunningRunStatus(candidates[index].status)) {
      return candidates[index];
    }
  }

  return candidates[candidates.length - 1];
}

function getEntryRunTarget(
  entry: AssistantContentEntry,
  runs: AgentRunInfo[],
  rootExecutionId?: string,
) {
  const item = entry.item;
  if (
    typeof item !== 'string' &&
    isAgentEventContent(item) &&
    item.event === 'middleware_event'
  ) {
    return null;
  }

  const executionId = readContentExecutionId(item);
  const parentExecutionId = readContentParentExecutionId(item);
  const agentKey = readContentAgentKey(item);

  if (executionId) {
    return {
      executionId,
      parentExecutionId,
      agentKey,
    };
  }

  const fallbackRun = findFallbackRunByAgentKey(
    runs,
    agentKey,
    rootExecutionId,
  );
  if (!fallbackRun) return null;

  return {
    executionId: fallbackRun.id,
    parentExecutionId: fallbackRun.parentId ?? fallbackRun.parentExecutionId,
    agentKey,
  };
}

function createInfoFromEntry(
  id: string,
  entry: AssistantContentEntry,
  parentExecutionId?: string,
): AgentRunInfo {
  return {
    id,
    ...(parentExecutionId
      ? { parentId: parentExecutionId, parentExecutionId }
      : {}),
    ...(readContentAgentKey(entry.item)
      ? { agentKey: readContentAgentKey(entry.item) }
      : {}),
    ...(readContentTitle(entry.item)
      ? { xpertName: readContentTitle(entry.item) }
      : {}),
    ...(readContentStringField(entry.item, 'runId')
      ? { runId: readContentStringField(entry.item, 'runId') }
      : {}),
  };
}

function normalizeAssistantEntries(message: AssistantMessageWithAgentRuns) {
  const entries: AssistantContentEntry[] = [];

  if (typeof message.content === 'string') {
    if (message.content.trim()) {
      entries.push({
        item: message.content,
        index: 0,
        source: 'content',
        order: 0,
      });
    }
  } else if (Array.isArray(message.content)) {
    message.content.forEach((item, index) => {
      if (isThreadContextUsageRenderArtifact(item)) return;

      entries.push({
        item,
        index,
        source: 'content',
        order: index,
      });
    });
  }

  const contentCount = entries.length;
  (message.reasoning ?? []).forEach((item, index) => {
    entries.push({
      item,
      index,
      source: 'reasoning',
      order: contentCount + index,
    });
  });

  return entries;
}

function refreshAgentNodeOrder(node: AgentRunRenderNode): number {
  let order = node.firstOrder;
  for (const child of node.children) {
    order = Math.min(order, refreshAgentNodeOrder(child));
  }
  node.firstOrder = order;
  node.children.sort((a, b) => a.firstOrder - b.firstOrder);
  return order;
}

function markIncompleteAgentRunStatusSuccess(node: AgentRunRenderNode) {
  if (normalizeRunStatus(node.info.status) === 'pending') {
    node.info.status = 'success';
  }

  node.children.forEach(markIncompleteAgentRunStatusSuccess);
}

export function buildAssistantRenderTree(
  message: AssistantMessageWithAgentRuns,
) {
  const rootExecutionId = message.executionId;
  const runs = (message.agentRuns ?? []).filter(
    (run) => !isMiddlewareAgentRunInfo(run),
  );
  const entries = normalizeAssistantEntries(message);
  const nodes = new Map<string, AgentRunRenderNode>();
  const rootEntries: AssistantContentEntry[] = [];
  const rootReasoning: TMessageContentReasoning[] = [];
  const baseOrder = entries.length + 1;

  runs.forEach((run, index) => {
    createAgentRunNode(nodes, run.id, run, baseOrder + index / 1000);
  });

  for (const entry of entries) {
    const target = getEntryRunTarget(entry, runs, rootExecutionId);
    const shouldGroup =
      Boolean(target?.executionId) &&
      (target?.executionId !== rootExecutionId ||
        Boolean(target?.parentExecutionId));

    if (!target || !shouldGroup) {
      if (entry.source === 'reasoning' && typeof entry.item !== 'string') {
        rootReasoning.push(entry.item as TMessageContentReasoning);
      } else {
        rootEntries.push(entry);
      }
      continue;
    }

    const node = createAgentRunNode(
      nodes,
      target.executionId,
      createInfoFromEntry(target.executionId, entry, target.parentExecutionId),
      entry.order,
    );
    node.entries.push(entry);
    node.firstOrder = Math.min(node.firstOrder, entry.order);
  }

  const roots: AgentRunRenderNode[] = [];
  for (const node of nodes.values()) {
    if (node.id === rootExecutionId && !node.info.parentId) {
      continue;
    }

    const parentId = node.info.parentId ?? node.info.parentExecutionId;
    if (parentId && parentId !== rootExecutionId && parentId !== node.id) {
      const parent = nodes.get(parentId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  roots.forEach(refreshAgentNodeOrder);
  if (normalizeRunStatus(message.status) === 'success') {
    roots.forEach(markIncompleteAgentRunStatusSuccess);
  }
  roots.sort((a, b) => a.firstOrder - b.firstOrder);

  const units: AssistantRenderUnit[] = [
    ...rootEntries.map((entry) => ({
      type: 'entry' as const,
      entry,
      order: entry.order,
    })),
    ...roots.map((node) => ({
      type: 'agent' as const,
      node,
      order: node.firstOrder,
    })),
  ].sort((a, b) => a.order - b.order);

  return {
    units,
    rootReasoning,
    hasAgentRuns: roots.length > 0,
  };
}
