import type { ChatFileChange } from './file-activity.js';
import { normalizeFileChanges, normalizeFileOutputs } from './file-activity.js';
import type { ChatTaskSummaryOutput, TChatTaskSummaryContribution } from './task-summary.js';

/** Host-owned facts from a tool execution, never an additional tool invocation. */
export type FileActivityReceipt = {
  version: 1;
  receiptId: string;
  toolCallId: string;
  updatedAt: string;
} & (
  | { kind: 'changes'; coverage: 'bounded' | 'partial' | 'unavailable'; fileChanges: ChatFileChange[] }
  | { kind: 'delivery'; status: 'success'; outputs: ChatTaskSummaryOutput[] }
  | { kind: 'delivery'; status: 'error'; error: string }
);

export type TMessageContentFileActivity = {
  id: string;
  type: 'file_activity';
  data: FileActivityReceipt;
  messageId?: string;
  executionId?: string;
  agentKey?: string;
  parentExecutionId?: string;
  runId?: string;
};

export function parseFileActivityContent(value: unknown): TMessageContentFileActivity | null {
  if (!value || typeof value !== 'object') return null;
  const part = value as Partial<TMessageContentFileActivity>;
  if (part.type !== 'file_activity' || typeof part.id !== 'string' || !part.id || !part.data || typeof part.data !== 'object') return null;
  const data = part.data;
  if (data.version !== 1 || data.receiptId !== part.id || typeof data.toolCallId !== 'string' || !data.toolCallId
    || typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt))) return null;
  const base = { version: 1 as const, receiptId: part.id, toolCallId: data.toolCallId, updatedAt: data.updatedAt };
  let receipt: FileActivityReceipt;
  if (data.kind === 'changes' && ['bounded', 'partial', 'unavailable'].includes(data.coverage) && Array.isArray(data.fileChanges)) {
    const fileChanges = normalizeFileChanges(data.fileChanges);
    if (fileChanges.length !== data.fileChanges.length) return null;
    receipt = { ...base, kind: 'changes', coverage: data.coverage, fileChanges };
  } else if (data.kind === 'delivery' && data.status === 'success' && Array.isArray(data.outputs)) {
    const outputs = normalizeFileOutputs(data.outputs);
    if (outputs.length !== data.outputs.length) return null;
    receipt = { ...base, kind: 'delivery', status: 'success', outputs };
  } else if (data.kind === 'delivery' && data.status === 'error' && typeof data.error === 'string') {
    receipt = { ...base, kind: 'delivery', status: 'error', error: data.error };
  } else return null;
  return { id: part.id, type: 'file_activity', data: receipt,
    ...(typeof part.messageId === 'string' ? { messageId: part.messageId } : {}),
    ...(typeof part.executionId === 'string' ? { executionId: part.executionId } : {}),
    ...(typeof part.agentKey === 'string' ? { agentKey: part.agentKey } : {}),
    ...(typeof part.parentExecutionId === 'string' ? { parentExecutionId: part.parentExecutionId } : {}),
    ...(typeof part.runId === 'string' ? { runId: part.runId } : {}) };
}

type LegacyStep = { id?: unknown; taskSummary?: TChatTaskSummaryContribution; _meta?: { 'xpertai/taskSummary'?: TChatTaskSummaryContribution } };
/** Compatibility uses explicit metadata and the original call identity, never labels or ID suffixes. */
export function getLegacyFileActivityContribution(value: unknown): TChatTaskSummaryContribution | null {
  if (!value || typeof value !== 'object') return null;
  const part = value as { id?: unknown; type?: unknown; data?: LegacyStep };
  const step = part.type === 'component' ? part.data : value as LegacyStep;
  if (!step || typeof step !== 'object') return null;
  const summary = step.taskSummary ?? step._meta?.['xpertai/taskSummary'];
  const id = part.id ?? step.id;
  return summary?.version === 1 && summary.fileActivityVersion === 1
    && typeof summary.fileActivityToolCallId === 'string' && Boolean(summary.fileActivityToolCallId)
    && typeof id === 'string' && id !== summary.fileActivityToolCallId ? summary : null;
}

export function isFileActivityContent(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && 'type' in value && value.type === 'file_activity')
    || getLegacyFileActivityContribution(value) !== null;
}

export function getFileActivityContribution(value: unknown): TChatTaskSummaryContribution | null {
  const part = parseFileActivityContent(value);
  if (!part) return getLegacyFileActivityContribution(value);
  const receipt = part.data;
  return { version: 1, fileActivityVersion: 1, fileActivityToolCallId: receipt.toolCallId,
    ...(receipt.kind === 'changes' ? { fileChanges: receipt.fileChanges, fileChangeCoverage: receipt.coverage }
      : receipt.status === 'success' ? { outputs: receipt.outputs } : {}) };
}

/** Receipts are immutable terminal facts; replay replaces by identity, never appends a second operation. */
export function upsertFileActivityContent<T>(content: T[], receipt: TMessageContentFileActivity): (T | TMessageContentFileActivity)[] {
  const index = content.findIndex((item) => parseFileActivityContent(item)?.id === receipt.id);
  if (index < 0) return [...content, receipt];
  const previous = parseFileActivityContent(content[index]);
  if (previous && Date.parse(previous.data.updatedAt) >= Date.parse(receipt.data.updatedAt)) return content;
  return content.map((item, position) => position === index ? receipt : item);
}
