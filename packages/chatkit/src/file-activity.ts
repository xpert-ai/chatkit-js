import { getFileActivityContribution } from './file-activity-receipt.js';
import type { ChatTaskSummaryOutput, ChatTaskSummaryResourceReference, TChatTaskSummaryContribution } from './task-summary.js';

export type FileRevision = { sha256: string; size: number };
export type ChatFileChange = {
  id: string;
  workspacePath: string;
  title: string;
  operation: 'added' | 'modified' | 'deleted' | 'unknown';
  before?: FileRevision | null;
  after?: FileRevision | null;
  resource?: Extract<ChatTaskSummaryResourceReference, { type: 'file_change' }>;
  coverage: 'observed' | 'legacy';
  messageId?: string;
  startedAt?: string;
  updatedAt?: string;
};
export type FileChangeLineStats =
  | { status: 'ready'; added: number; removed: number }
  | { status: 'unavailable' };
export type MessageFileChangeStats = {
  messageId: string;
  items: { workspacePath: string; resource?: Extract<ChatTaskSummaryResourceReference, { type: 'file_change' }>; stats: FileChangeLineStats }[];
};
/** Stable cache identity for a fixed review range; never identifies mutable workspace bytes. */
export function fileChangeRangeKey(resource: Extract<ChatTaskSummaryResourceReference, { type: 'file_change' }>) {
  return JSON.stringify([resource.first.artifactId, resource.first.artifactVersionId, resource.last.artifactId, resource.last.artifactVersionId]);
}

/** Private review payload. Never include text/diffs in compact task summaries. */
export type FileChangeReport = {
  schema: 'xpert.file-change.v1';
  workspacePath: string;
  before: (FileRevision & { text?: string }) | null;
  after: (FileRevision & { text?: string }) | null;
};

const writeTools = new Set(['sandbox_write_file', 'sandbox_append_file', 'sandbox_edit_file', 'sandbox_multi_edit_file']);
type Part = { id?: string; type?: string; data?: { tool?: string; status?: string; input?: { file_path?: string }; output?: string; taskSummary?: TChatTaskSummaryContribution; _meta?: { 'xpertai/taskSummary'?: TChatTaskSummaryContribution } } };
export type FileActivityMessage = { id?: string; content?: unknown; taskSummary?: TChatTaskSummaryContribution; updatedAt?: string | Date; createdAt?: string | Date };

export function normalizeFileChanges(value: unknown): ChatFileChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChatFileChange => {
    if (!item || typeof item !== 'object') return false;
    const change = item as Partial<ChatFileChange>;
    return typeof change.id === 'string' && typeof change.workspacePath === 'string' && typeof change.title === 'string'
      && ['added', 'modified', 'deleted', 'unknown'].includes(change.operation ?? '')
      && ['observed', 'legacy'].includes(change.coverage ?? '')
      && (!change.resource || (change.resource.type === 'file_change' && validVersion(change.resource.first) && validVersion(change.resource.last)))
      && validRevision(change.before) && validRevision(change.after);
  }).map(({ id, title, workspacePath, operation, before, after, resource, coverage, messageId, startedAt, updatedAt }) => ({
    id, title, workspacePath, operation, before: compactRevision(before), after: compactRevision(after), resource, coverage, messageId, startedAt, updatedAt,
  }));
}
function compactRevision(value: FileRevision | null | undefined) {
  return value ? { sha256: value.sha256, size: value.size } : value;
}
export function normalizeFileOutputs(value: unknown): ChatTaskSummaryOutput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const output = compactOutput(item as ChatTaskSummaryOutput);
    return output ? [output] : [];
  });
}
function compactOutput(value: ChatTaskSummaryOutput): ChatTaskSummaryOutput | null {
  if (!value || typeof value.id !== 'string' || typeof value.title !== 'string'
    || !['file', 'image', 'document', 'spreadsheet', 'presentation', 'site', 'url', 'mcp_app'].includes(value.kind)
    || (value.status !== undefined && value.status !== 'success')) return null;
  const ref = value.resource;
  const resource: ChatTaskSummaryOutput['resource'] = ref?.type === 'artifact' && typeof ref.artifactId === 'string'
    ? { type: 'artifact', artifactId: ref.artifactId, ...(typeof ref.artifactVersionId === 'string' ? { artifactVersionId: ref.artifactVersionId } : {}) }
    : ref?.type === 'workspace_file' && typeof ref.workspacePath === 'string'
      ? { type: 'workspace_file', workspacePath: ref.workspacePath, fileAssetId: ref.fileAssetId, storageFileId: ref.storageFileId }
      : ref?.type === 'url' && typeof ref.url === 'string' ? { type: 'url', url: ref.url } : undefined;
  if (!resource) return null;
  const { id, kind, title, description, status, origin, workspacePath, mimeType, size, sha256, messageId, updatedAt } = value;
  return { id, kind, title, description, status, resource, origin, workspacePath, mimeType, size, sha256, messageId, updatedAt };
}
function validVersion(value: { artifactId?: string; artifactVersionId?: string } | undefined) {
  return Boolean(value && typeof value.artifactId === 'string' && typeof value.artifactVersionId === 'string');
}
function validRevision(value: FileRevision | null | undefined) {
  return value == null || (typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.size) && value.size >= 0);
}

/** Collapse observed operations to the net change, retaining immutable first/last review references. */
export function mergeFileChanges(items: ChatFileChange[]): ChatFileChange[] {
  const byPath = new Map<string, ChatFileChange>();
  for (const item of [...items].sort((a, b) => (a.startedAt ?? a.updatedAt ?? '').localeCompare(b.startedAt ?? b.updatedAt ?? ''))) {
    const previous = byPath.get(item.workspacePath);
    if (!previous || previous.coverage === 'legacy') { byPath.set(item.workspacePath, item); continue; }
    if (item.coverage === 'legacy') continue;
    const latest = (item.updatedAt ?? '') >= (previous.updatedAt ?? '') ? item : previous;
    const earliest = (item.startedAt ?? item.updatedAt ?? '') < (previous.startedAt ?? previous.updatedAt ?? '') ? item : previous;
    const before = earliest.before;
    const after = latest.after;
    byPath.set(item.workspacePath, {
      ...latest, before, after, startedAt: earliest.startedAt ?? earliest.updatedAt,
      operation: before === null ? 'added' : after === null ? 'deleted' : 'modified',
      resource: earliest.resource && latest.resource ? { type: 'file_change', first: earliest.resource.first, last: latest.resource.last } : latest.resource,
    });
  }
  return [...byPath.values()].filter((item) => item.coverage === 'legacy' || item.before?.sha256 !== item.after?.sha256)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

/** Shared live/history projection. Proven tool writes move out of outputs, never filename-based classification. */
export function projectMessageFileActivity(message: FileActivityMessage, contribution: TChatTaskSummaryContribution): TChatTaskSummaryContribution {
  const parts = Array.isArray(message.content) ? message.content as Part[] : [];
  const observed: TChatTaskSummaryContribution[] = [];
  const legacyChanges: ChatFileChange[] = [];
  const legacyOutputIds = new Set<string>();
  const date = message.updatedAt ?? message.createdAt;
  const updatedAt = date instanceof Date ? date.toISOString() : date;
  const observedToolCalls = new Set(parts.flatMap((part) => {
    const summary = getFileActivityContribution(part) ?? part.data?.taskSummary ?? part.data?._meta?.['xpertai/taskSummary'];
    return summary?.fileActivityToolCallId ? [summary.fileActivityToolCallId] : [];
  }));
  for (const part of parts) {
    const receipt = getFileActivityContribution(part);
    if (receipt) { observed.push(receipt); continue; }
    if (part?.type !== 'component' || !part.data) continue;
    const data = part.data;
    const explicit = data.taskSummary ?? data._meta?.['xpertai/taskSummary'];
    if (explicit?.version === 1) observed.push(explicit);
    if (!writeTools.has(data.tool ?? '') || data.status !== 'success') continue;
    const path = data.input?.file_path;
    if (typeof path !== 'string' || !path || path.startsWith('/') || path.split('/').includes('..')) continue;
    legacyOutputIds.add(`workspace-file:${path}`);
    if (explicit?.fileActivityVersion === 1 || (part.id && observedToolCalls.has(part.id))) continue;
    // Historical receipts cannot prove a diff or even an actual write; label them honestly.
    legacyChanges.push({ id: `file-change:${path}`, title: path, workspacePath: path, operation: 'unknown', coverage: 'legacy', messageId: message.id, updatedAt });
  }
  if (!observed.length && !legacyOutputIds.size && !contribution.outputs?.length && !contribution.fileChanges?.length) return contribution;
  const outputs = [...(contribution.outputs ?? []), ...observed.flatMap((item) => item.outputs ?? [])];
  const byId = new Map<string, ChatTaskSummaryOutput>();
  for (const raw of outputs) {
    const output = compactOutput(raw);
    if (!output) continue;
    if (legacyOutputIds.has(output.id) && output.origin !== 'tool' && output.origin !== 'integration') continue;
    if ((byId.get(output.id)?.updatedAt ?? '') > (output.updatedAt ?? updatedAt ?? '')) continue;
    byId.set(output.id, { ...output, origin: output.origin ?? 'legacy', messageId: message.id ?? output.messageId, updatedAt: output.updatedAt ?? updatedAt });
  }
  const changes = mergeFileChanges([
    ...legacyChanges,
    ...normalizeFileChanges(contribution.fileChanges),
    ...observed.flatMap((item) => normalizeFileChanges(item.fileChanges)),
  ].map((item) => ({ ...item, messageId: message.id ?? item.messageId })));
  const coverage = [contribution.fileChangeCoverage, ...observed.map((item) => item.fileChangeCoverage)];
  const fileChangeCoverage = coverage.includes('unavailable') ? 'unavailable' : coverage.includes('partial') ? 'partial' : coverage.includes('bounded') ? 'bounded' : undefined;
  return { ...contribution, fileActivityVersion: 1, fileChangeCoverage, outputs: [...byId.values()], fileChanges: changes };
}

export function parseFileChangeReport(value: unknown): FileChangeReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as Partial<FileChangeReport>;
  const revision = (item: FileChangeReport['before'] | undefined) => item === null || Boolean(item && validRevision(item) && (item.text === undefined || (typeof item.text === 'string' && item.text.length <= 32768)));
  return report.schema === 'xpert.file-change.v1' && typeof report.workspacePath === 'string'
    && revision(report.before) && revision(report.after) ? report as FileChangeReport : null;
}
