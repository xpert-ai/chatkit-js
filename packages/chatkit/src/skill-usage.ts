/** Snapshot produced by the runtime after successfully loading skill instructions. */
export type ChatSkillUsage = {
  skillId: string;
  name: string;
  version: string;
  source: {
    type: 'workspace' | 'project' | 'assistant' | 'plugin';
    id: string;
  };
  activation: 'read';
  toolCallId: string;
  executionId?: string;
  loadedAt: string;
};

export function chatSkillUsageKey(usage: ChatSkillUsage): string {
  return JSON.stringify([
    usage.source.type,
    usage.source.id,
    usage.skillId,
    usage.version,
  ]);
}

/** Merge only observations belonging to the same message. Keep the first read. */
export function mergeChatSkillUsages(
  ...groups: ReadonlyArray<readonly ChatSkillUsage[] | undefined>
): ChatSkillUsage[] {
  const usages = new Map<string, ChatSkillUsage>();
  for (const group of groups) {
    for (const usage of group ?? []) {
      const key = chatSkillUsageKey(usage);
      if (!usages.has(key)) usages.set(key, usage);
    }
  }
  return [...usages.values()];
}

/** JSON boundary: allowlist fields rather than forwarding paths or raw tool data. */
export function normalizeChatSkillUsages(value: unknown): ChatSkillUsage[] {
  if (!Array.isArray(value)) return [];
  const usages: ChatSkillUsage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || item.activation !== 'read')
      continue;
    const { source } = item;
    if (
      !source ||
      typeof source !== 'object' ||
      !['workspace', 'project', 'assistant', 'plugin'].includes(source.type) ||
      typeof source.id !== 'string' ||
      !source.id.trim()
    )
      continue;
    if (
      typeof item.skillId !== 'string' ||
      !item.skillId.trim() ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.version !== 'string' ||
      typeof item.toolCallId !== 'string' ||
      !item.toolCallId.trim() ||
      typeof item.loadedAt !== 'string' ||
      !Number.isFinite(Date.parse(item.loadedAt))
    )
      continue;
    usages.push({
      skillId: item.skillId,
      name: item.name,
      version: item.version,
      source: { type: source.type, id: source.id },
      activation: 'read',
      toolCallId: item.toolCallId,
      ...(typeof item.executionId === 'string' && item.executionId
        ? { executionId: item.executionId }
        : {}),
      loadedAt: item.loadedAt,
    });
  }
  return mergeChatSkillUsages(usages);
}

function summarySkillUsages(summary: unknown): ChatSkillUsage[] {
  return summary &&
    typeof summary === 'object' &&
    'version' in summary &&
    summary.version === 1 &&
    'skillUsages' in summary
    ? normalizeChatSkillUsages(summary.skillUsages)
    : [];
}

/** Works for both streamed tool components and persisted message summaries. */
export function getMessageSkillUsages(message: {
  content?: unknown;
  taskSummary?: unknown;
}): ChatSkillUsage[] {
  const groups = [summarySkillUsages(message.taskSummary)];
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part?.type === 'component' && part.data?.status === 'success') {
        groups.push(summarySkillUsages(part.data.taskSummary));
      }
    }
  }
  return mergeChatSkillUsages(...groups);
}
