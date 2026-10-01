import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import {
  resolveLocalizedText,
  type LocalizedText,
} from '../../../../../i18n/localized-text';
import { isSandboxShellStep } from '../../sandbox-shell-tool-call';
import { getToolStepData } from '../status/step-status';
import type { StepStatus, ToolGroupCategory } from '../types';

export const TOOL_GROUP_CATEGORY_ORDER: ToolGroupCategory[] = [
  'files',
  'searches',
  'commands',
  'lists',
  'tasks',
  'knowledges',
  'tools',
];

const TOOL_GROUP_TOKEN_CATEGORY: Record<string, ToolGroupCategory> = {
  file: 'files',
  files: 'files',
  web_search: 'searches',
  search: 'searches',
  searches: 'searches',
  program: 'commands',
  command: 'commands',
  commands: 'commands',
  shell: 'commands',
  terminal: 'commands',
  list: 'lists',
  lists: 'lists',
  task: 'tasks',
  tasks: 'tasks',
  todo: 'tasks',
  todos: 'tasks',
  knowledge: 'knowledges',
  knowledges: 'knowledges',
  retriever: 'knowledges',
  retrieval: 'knowledges',
  tool: 'tools',
  tools: 'tools',
};

export function normalizeToolToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return normalized || null;
}

function classifyToolToken(
  value: LocalizedText | unknown,
): ToolGroupCategory | null {
  const normalized = normalizeToolToken(
    typeof value === 'string' ? value : resolveLocalizedText(value, 'en-US'),
  );
  if (!normalized) return null;

  const directMatch = TOOL_GROUP_TOKEN_CATEGORY[normalized];
  if (directMatch) return directMatch;

  if (normalized.includes('search')) return 'searches';
  if (normalized.includes('file')) return 'files';
  if (
    normalized.includes('command') ||
    normalized.includes('cmd') ||
    normalized.includes('program') ||
    normalized.includes('exec') ||
    normalized.includes('shell') ||
    normalized.includes('terminal') ||
    normalized.startsWith('run_') ||
    normalized.includes('_run')
  ) {
    return 'commands';
  }
  if (normalized.includes('list')) return 'lists';
  if (normalized.includes('task') || normalized.includes('todo'))
    return 'tasks';
  if (normalized.includes('knowledge') || normalized.includes('retriever')) {
    return 'knowledges';
  }

  return null;
}

function getToolGroupCategory(
  content: TMessageContentComponent,
): ToolGroupCategory {
  const data = getToolStepData(content);
  if (isSandboxShellStep(data)) return 'commands';

  return (
    classifyToolToken(data.type) ??
    classifyToolToken(data.tool) ??
    classifyToolToken(data.title) ??
    classifyToolToken(data.message) ??
    'tools'
  );
}

export function getToolGroupCategoryCounts(
  items: TMessageContentComponent[],
): Partial<Record<ToolGroupCategory, number>> {
  return items.reduce<Partial<Record<ToolGroupCategory, number>>>(
    (counts, item) => {
      const category = getToolGroupCategory(item);
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

export function getToolActivityLabel(
  content: TMessageContentComponent,
  language: string,
  statusOverride?: StepStatus,
) {
  const data = getToolStepData(content);
  const status = statusOverride ?? data.status;
  const message = resolveLocalizedText(data.message, language);
  const title = resolveLocalizedText(data.title, language);
  const tool = resolveLocalizedText(data.tool, language);
  const type = resolveLocalizedText(data.type, language);

  if (status === 'running') {
    return message ?? title ?? tool ?? type ?? 'Tool';
  }

  const titleToken = normalizeToolToken(title);
  const genericTitle =
    titleToken !== null &&
    [tool, type]
      .map((candidate) => normalizeToolToken(candidate))
      .some((candidate) => candidate === titleToken);
  if (message && (!title || genericTitle)) {
    return message;
  }

  return title ?? message ?? tool ?? type ?? 'Tool';
}
