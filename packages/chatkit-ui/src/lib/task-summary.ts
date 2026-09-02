import type {
  ChatKitReference,
  ChatTaskSummaryOutput,
  ChatTaskSummaryOutputKind,
  ChatTaskSummaryPlan,
  ChatTaskSummaryResourceReference,
  ChatTaskSummarySource,
  ChatTaskSummarySourceKind,
  ChatTaskSummaryTodos,
  ChatTaskSummaryTodoStatus,
  TChatTaskSummaryContribution,
  ThreadGoal,
} from '@xpert-ai/chatkit-types';
import type { Client } from '@xpert-ai/xpert-sdk';
import type { AgentRunInfo } from './agent-runs';
import type { RuntimeCapabilitiesSelection } from './runtime-capabilities';
import type { TodoListSnapshot } from './todos';

type TaskSummaryConversationsApi = Pick<
  Client['conversations'],
  'getTaskSummary' | 'listTaskSummaryItems'
>;

export type TaskSummarySnapshot = Awaited<
  ReturnType<TaskSummaryConversationsApi['getTaskSummary']>
>;
export type TaskSummarySection = Parameters<
  TaskSummaryConversationsApi['listTaskSummaryItems']
>[1];
export type TaskSummaryAgent = TaskSummarySnapshot['agents']['items'][number];
export type TaskSummaryPending =
  TaskSummarySnapshot['pending']['items'][number];

const PLAN_PATTERN = /<proposed_plan>\s*([\s\S]*?)\s*<\/proposed_plan>/i;
const WEB_SEARCH_RESULT_PATTERN =
  /^Title:\s*(.+?)\r?\nURL:\s*(https?:\/\/\S+)\s*$/gim;
const SANDBOX_FILE_OUTPUT_TOOLS = new Set([
  'sandbox_write_file',
  'sandbox_append_file',
  'sandbox_edit_file',
  'sandbox_multi_edit_file',
]);

export type TaskSummaryMessage = {
  id?: string;
  content?: unknown;
  updatedAt?: string;
  createdAt?: string;
  taskSummary?: TChatTaskSummaryContribution;
  references?: ChatKitReference[];
  attachments?: Record<string, unknown>[];
  fileAssets?: Record<string, unknown>[];
  agentRuns?: AgentRunInfo[];
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
};

export type TaskSummaryRuntimeItem = {
  id: string;
  title: string;
  status?: string;
  description?: string;
  resource?: ChatTaskSummaryOutput['resource'];
  updatedAt?: string;
};

export type TaskSummaryLiveData = {
  goal?: ThreadGoal | null;
  plan?: ChatTaskSummaryPlan;
  todos?: ChatTaskSummaryTodos;
  outputs: ChatTaskSummaryOutput[];
  sources: ChatTaskSummarySource[];
  agents: TaskSummaryAgent[];
  pending: TaskSummaryPending[];
  running: TaskSummaryRuntimeItem[];
};

export type MergedTaskSummary = TaskSummaryLiveData & {
  totals: Record<'outputs' | 'sources' | 'agents' | 'pending', number>;
};

type ComponentPartCandidate = {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  url?: unknown;
  image_url?: unknown;
  data?: unknown;
};

type ComponentDataCandidate = {
  type?: unknown;
  title?: unknown;
  taskSummary?: unknown;
  _meta?: unknown;
  artifact?: unknown;
  artifactLink?: unknown;
  file?: unknown;
  input?: unknown;
  tool?: unknown;
  output?: unknown;
  status?: unknown;
  url?: unknown;
};

type SummaryMetaCandidate = {
  'xpertai/taskSummary'?: unknown;
};

type ArtifactCandidate = {
  id?: unknown;
  artifactId?: unknown;
  kind?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  workspacePath?: unknown;
  fileAssetId?: unknown;
  storageFileId?: unknown;
};

type ContributionCandidate = {
  version?: unknown;
  plan?: unknown;
  todos?: unknown;
  outputs?: unknown;
  sources?: unknown;
};

type SummaryItemCandidate = {
  id?: unknown;
  kind?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  resource?: unknown;
  messageId?: unknown;
  updatedAt?: unknown;
};

type SummaryResourceCandidate = {
  type?: unknown;
  messageId?: unknown;
  workspacePath?: unknown;
  fileAssetId?: unknown;
  storageFileId?: unknown;
  artifactId?: unknown;
  serviceId?: unknown;
  url?: unknown;
};

type SandboxFileInputCandidate = {
  file_path?: unknown;
};

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function contentParts(content: unknown): ComponentPartCandidate[] {
  return Array.isArray(content)
    ? content.filter((part): part is ComponentPartCandidate => isObject(part))
    : [];
}

function messageText(content: unknown) {
  if (typeof content === 'string') return content;
  return contentParts(content)
    .map((part) =>
      isObject(part) && 'text' in part ? (stringValue(part.text) ?? '') : '',
    )
    .join('\n');
}

export function normalizeTaskSummaryContribution(
  value: unknown,
): TChatTaskSummaryContribution | null {
  if (!isObject(value)) return null;
  const candidate = value as ContributionCandidate;
  if (candidate.version !== 1) return null;
  const plan = normalizePlan(candidate.plan);
  const todos = normalizeTodos(candidate.todos);
  const outputs = Array.isArray(candidate.outputs)
    ? candidate.outputs.flatMap((item) => normalizeOutput(item) ?? [])
    : [];
  const sources = Array.isArray(candidate.sources)
    ? candidate.sources.flatMap((item) => normalizeSource(item) ?? [])
    : [];
  return {
    version: 1,
    ...(plan ? { plan } : {}),
    ...(todos ? { todos } : {}),
    ...(outputs.length ? { outputs } : {}),
    ...(sources.length ? { sources } : {}),
  };
}

function normalizePlan(value: unknown): ChatTaskSummaryPlan | null {
  if (!isObject(value)) return null;
  const candidate = value as {
    title?: unknown;
    excerpt?: unknown;
    messageId?: unknown;
    updatedAt?: unknown;
  };
  const title = stringValue(candidate.title);
  const excerpt = stringValue(candidate.excerpt);
  return title && excerpt
    ? {
        title,
        excerpt,
        messageId: stringValue(candidate.messageId),
        updatedAt: stringValue(candidate.updatedAt),
      }
    : null;
}

function normalizeTodos(value: unknown): ChatTaskSummaryTodos | null {
  if (!isObject(value)) return null;
  const candidate = value as {
    componentId?: unknown;
    title?: unknown;
    items?: unknown;
    messageId?: unknown;
    updatedAt?: unknown;
  };
  const componentId = stringValue(candidate.componentId);
  if (!componentId || !Array.isArray(candidate.items)) return null;
  const items = candidate.items.flatMap((item) => {
    if (!isObject(item)) return [];
    const todo = item as { id?: unknown; content?: unknown; status?: unknown };
    const id = stringValue(todo.id);
    const content = stringValue(todo.content);
    const status = todo.status;
    return id && content && isTodoStatus(status)
      ? [{ id, content, status }]
      : [];
  });
  return items.length
    ? {
        componentId,
        title: stringValue(candidate.title),
        items,
        messageId: stringValue(candidate.messageId),
        updatedAt: stringValue(candidate.updatedAt),
      }
    : null;
}

function isTodoStatus(value: unknown): value is ChatTaskSummaryTodoStatus {
  return (
    value === 'pending' || value === 'in_progress' || value === 'completed'
  );
}

function normalizeOutput(value: unknown): ChatTaskSummaryOutput | null {
  if (!isObject(value)) return null;
  const candidate = value as SummaryItemCandidate;
  const id = stringValue(candidate.id);
  const title = stringValue(candidate.title);
  const kind = artifactKind(candidate.kind);
  const status = stringValue(candidate.status)?.toLowerCase();
  const normalizedStatus = status === 'success' ? status : undefined;
  const resource = normalizeResource(candidate.resource);
  if (
    !id ||
    !title ||
    !kind ||
    (status !== undefined && status !== 'success') ||
    !isOpenableOutputResource(resource)
  ) {
    return null;
  }
  return {
    id,
    kind,
    title,
    description: stringValue(candidate.description),
    status: normalizedStatus,
    resource,
    messageId: stringValue(candidate.messageId),
    updatedAt: stringValue(candidate.updatedAt),
  };
}

function isCompletedOpenableOutput(output: ChatTaskSummaryOutput) {
  return (
    (output.status === undefined || output.status === 'success') &&
    isOpenableOutputResource(output.resource)
  );
}

function isOpenableOutputResource(
  resource: ChatTaskSummaryOutput['resource'],
): resource is NonNullable<ChatTaskSummaryOutput['resource']> {
  return (
    resource?.type === 'workspace_file' ||
    resource?.type === 'artifact' ||
    resource?.type === 'url'
  );
}

function normalizeSource(value: unknown): ChatTaskSummarySource | null {
  if (!isObject(value)) return null;
  const candidate = value as SummaryItemCandidate;
  const id = stringValue(candidate.id);
  const title = stringValue(candidate.title);
  if (!id || !title || !isSourceKind(candidate.kind)) return null;
  return {
    id,
    kind: candidate.kind,
    title,
    description: stringValue(candidate.description),
    resource: normalizeResource(candidate.resource),
    messageId: stringValue(candidate.messageId),
    updatedAt: stringValue(candidate.updatedAt),
  };
}

function normalizeResource(
  value: unknown,
): ChatTaskSummaryResourceReference | undefined {
  if (!isObject(value)) return undefined;
  const candidate = value as SummaryResourceCandidate;
  if (candidate.type === 'message') {
    const messageId = stringValue(candidate.messageId);
    return messageId ? { type: 'message', messageId } : undefined;
  }
  if (candidate.type === 'workspace_file') {
    const workspacePath = stringValue(candidate.workspacePath);
    return workspacePath
      ? {
          type: 'workspace_file',
          workspacePath,
          fileAssetId: stringValue(candidate.fileAssetId),
          storageFileId: stringValue(candidate.storageFileId),
        }
      : undefined;
  }
  if (candidate.type === 'artifact') {
    const artifactId = stringValue(candidate.artifactId);
    return artifactId ? { type: 'artifact', artifactId } : undefined;
  }
  if (candidate.type === 'browser') {
    const serviceId = stringValue(candidate.serviceId);
    const url = stringValue(candidate.url);
    return serviceId || url ? { type: 'browser', serviceId, url } : undefined;
  }
  if (candidate.type === 'url') {
    const url = stringValue(candidate.url);
    return url ? { type: 'url', url } : undefined;
  }
  return undefined;
}

function isSourceKind(value: unknown): value is ChatTaskSummarySourceKind {
  return (
    value === 'attachment' ||
    value === 'code' ||
    value === 'quote' ||
    value === 'image' ||
    value === 'web_page' ||
    value === 'file_element' ||
    value === 'knowledge' ||
    value === 'skill' ||
    value === 'plugin' ||
    value === 'sub_agent'
  );
}

function contributionFromPart(part: ComponentPartCandidate) {
  if (part.type !== 'component' || !isObject(part.data)) return null;
  const data = part.data as ComponentDataCandidate;
  const direct = normalizeTaskSummaryContribution(data.taskSummary);
  const metadataContribution = isObject(data._meta)
    ? normalizeTaskSummaryContribution(
        (data._meta as SummaryMetaCandidate)['xpertai/taskSummary'],
      )
    : null;
  return direct ?? metadataContribution;
}

function extractPlan(
  message: TaskSummaryMessage,
): ChatTaskSummaryPlan | undefined {
  const match = PLAN_PATTERN.exec(messageText(message.content));
  const markdown = match?.[1]?.trim();
  if (!markdown) return undefined;
  const title = markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s+/, '').trim())
    .find(Boolean);
  const excerpt = markdown.replace(/\s+/g, ' ').trim();
  return {
    title: title ?? 'Plan',
    excerpt:
      excerpt.length <= 160 ? excerpt : `${excerpt.slice(0, 157).trimEnd()}...`,
    messageId: message.id,
    updatedAt: message.updatedAt ?? message.createdAt,
  };
}

function artifactKind(value: unknown): ChatTaskSummaryOutputKind | null {
  switch (value) {
    case 'file':
    case 'image':
    case 'document':
    case 'spreadsheet':
    case 'presentation':
    case 'site':
    case 'url':
    case 'mcp_app':
      return value;
    case 'html':
      return 'site';
    case 'markdown':
    case 'pdf':
      return 'document';
    case 'pptx':
      return 'presentation';
    default:
      return null;
  }
}

function knownPartOutputs(
  part: ComponentPartCandidate,
  message: TaskSummaryMessage,
): ChatTaskSummaryOutput[] {
  const updatedAt = message.updatedAt ?? message.createdAt;
  if (part.type === 'image_url') {
    const url =
      stringValue(part.image_url) ??
      (isObject(part.image_url) && 'url' in part.image_url
        ? stringValue(part.image_url.url)
        : undefined);
    return url
      ? [
          {
            id: `image:${url}`,
            kind: 'image',
            title: stringValue(part.title) ?? 'Image',
            resource: { type: 'url', url },
            messageId: message.id,
            updatedAt,
          },
        ]
      : [];
  }
  if (part.type === 'iframe') {
    const url =
      stringValue(part.url) ??
      (isObject(part.data)
        ? stringValue((part.data as ComponentDataCandidate).url)
        : undefined);
    return url
      ? [
          {
            id: `url:${url}`,
            kind: 'url',
            title: stringValue(part.title) ?? url,
            resource: { type: 'url', url },
            messageId: message.id,
            updatedAt,
          },
        ]
      : [];
  }
  if (part.type !== 'component' || !isObject(part.data)) return [];
  const data = part.data as ComponentDataCandidate;
  const outputs = [...(contributionFromPart(part)?.outputs ?? [])];
  const sandboxOutput = sandboxFileOutput(data, message);
  if (sandboxOutput) outputs.push(sandboxOutput);
  if (
    isObject(data.artifact) &&
    isCompletedOutputStatus((data.artifact as ArtifactCandidate).status)
  ) {
    const artifact = data.artifact as ArtifactCandidate;
    const artifactId =
      stringValue(artifact.artifactId) ?? stringValue(artifact.id);
    const workspacePath = stringValue(artifact.workspacePath);
    const kind = artifactKind(artifact.kind) ?? 'file';
    const id = artifactId ?? stringValue(artifact.fileAssetId) ?? workspacePath;
    if (kind && id && (artifactId || workspacePath)) {
      outputs.push({
        id: `artifact:${id}`,
        kind,
        title: stringValue(artifact.title) ?? id,
        description: stringValue(artifact.description),
        resource: artifactId
          ? { type: 'artifact', artifactId }
          : {
              type: 'workspace_file',
              workspacePath: workspacePath as string,
              fileAssetId: stringValue(artifact.fileAssetId),
              storageFileId: stringValue(artifact.storageFileId),
            },
        messageId: message.id,
        updatedAt,
      });
    }
  }
  for (const value of [data.artifactLink, data.file]) {
    if (!isObject(value)) continue;
    const artifact = value as ArtifactCandidate;
    if (!isCompletedOutputStatus(artifact.status)) continue;
    const artifactId =
      stringValue(artifact.artifactId) ?? stringValue(artifact.id);
    const workspacePath = stringValue(artifact.workspacePath);
    const id = artifactId ?? stringValue(artifact.fileAssetId) ?? workspacePath;
    if (!id || (!artifactId && !workspacePath)) continue;
    outputs.push({
      id: `artifact:${id}`,
      kind: artifactKind(artifact.kind) ?? 'file',
      title: stringValue(artifact.title) ?? id,
      description: stringValue(artifact.description),
      resource: artifactId
        ? { type: 'artifact', artifactId }
        : {
            type: 'workspace_file',
            workspacePath: workspacePath as string,
            fileAssetId: stringValue(artifact.fileAssetId),
            storageFileId: stringValue(artifact.storageFileId),
          },
      messageId: message.id,
      updatedAt,
    });
  }
  return outputs;
}

function sandboxFileOutput(
  data: ComponentDataCandidate,
  message: TaskSummaryMessage,
): ChatTaskSummaryOutput | undefined {
  const tool = stringValue(data.tool);
  const status = stringValue(data.status)?.toLowerCase();
  if (
    !tool ||
    !SANDBOX_FILE_OUTPUT_TOOLS.has(tool) ||
    status !== 'success' ||
    !isObject(data.input)
  ) {
    return undefined;
  }
  const workspacePath = portableWorkspacePath(
    (data.input as SandboxFileInputCandidate).file_path,
  );
  if (!workspacePath) return undefined;
  return {
    id: `workspace-file:${workspacePath}`,
    kind: outputKindFromPath(workspacePath),
    title: workspacePath.split('/').at(-1) ?? workspacePath,
    status: 'success',
    resource: { type: 'workspace_file', workspacePath },
    messageId: message.id,
    updatedAt: message.updatedAt ?? message.createdAt,
  };
}

function portableWorkspacePath(value: unknown) {
  const path = stringValue(value)
    ?.replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/{2,}/g, '/');
  if (
    !path ||
    path.startsWith('/') ||
    /^[a-z]:\//i.test(path) ||
    path.split('/').some((segment) => segment === '..')
  ) {
    return undefined;
  }
  return path;
}

function outputKindFromPath(path: string): ChatTaskSummaryOutputKind {
  const extension = path.match(/\.([^./]+)$/)?.[1]?.toLowerCase();
  if (extension === 'html' || extension === 'htm') return 'site';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(extension ?? ''))
    return 'image';
  if (['csv', 'xls', 'xlsx', 'ods'].includes(extension ?? ''))
    return 'spreadsheet';
  if (['ppt', 'pptx', 'odp'].includes(extension ?? ''))
    return 'presentation';
  if (
    ['pdf', 'doc', 'docx', 'md', 'markdown', 'txt', 'rtf', 'odt'].includes(
      extension ?? '',
    )
  )
    return 'document';
  return 'file';
}

function isCompletedOutputStatus(value: unknown) {
  const status = stringValue(value)?.toLowerCase();
  return status === undefined || status === 'success';
}

function sourceFromReference(
  reference: ChatKitReference,
  message: TaskSummaryMessage,
): ChatTaskSummarySource {
  const updatedAt = message.updatedAt ?? message.createdAt;
  const common = {
    id: reference.id ?? `${reference.type}:${reference.text}`,
    title: reference.label?.trim() || reference.text.trim().slice(0, 80),
    messageId: message.id,
    updatedAt,
  };
  if (reference.type === 'code') {
    return {
      ...common,
      kind: 'code',
      title: reference.label ?? reference.path,
      description: `${reference.path}:${reference.startLine}-${reference.endLine}`,
      resource: message.id
        ? { type: 'message', messageId: message.id }
        : undefined,
    };
  }
  if (reference.type === 'image') {
    return {
      ...common,
      kind: 'image',
      title: reference.name ?? common.title,
      resource: reference.url ? { type: 'url', url: reference.url } : undefined,
    };
  }
  if (reference.type === 'element') {
    return {
      ...common,
      kind: 'web_page',
      title: reference.pageTitle ?? reference.pageUrl,
      description: reference.pageUrl,
      resource: {
        type: 'browser',
        serviceId: reference.serviceId,
        url: reference.pageUrl,
      },
    };
  }
  if (reference.type === 'file_element') {
    return {
      ...common,
      kind: 'file_element',
      title: reference.documentTitle ?? reference.filePath,
      description: reference.filePath,
      resource: { type: 'workspace_file', workspacePath: reference.filePath },
    };
  }
  return { ...common, kind: 'quote', description: reference.source };
}

function fileSources(
  files: Record<string, unknown>[] | undefined,
  message: TaskSummaryMessage,
) {
  return (files ?? []).flatMap((file) => {
    const id =
      stringValue(file.fileAssetId) ??
      stringValue(file.id) ??
      stringValue(file.storageFileId);
    const title =
      stringValue(file.originalName) ??
      stringValue(file.name) ??
      stringValue(file.fileName);
    if (!id || !title) return [];
    const workspacePath = stringValue(file.workspacePath);
    return [
      {
        id: `attachment:${id}`,
        kind: 'attachment' as const,
        title,
        resource: workspacePath
          ? {
              type: 'workspace_file' as const,
              workspacePath,
              fileAssetId:
                stringValue(file.fileAssetId) ?? stringValue(file.id),
              storageFileId: stringValue(file.storageFileId),
            }
          : message.id
            ? { type: 'message' as const, messageId: message.id }
            : undefined,
        messageId: message.id,
        updatedAt: message.updatedAt ?? message.createdAt,
      },
    ];
  });
}

function webSearchSources(
  part: ComponentPartCandidate,
  message: TaskSummaryMessage,
): ChatTaskSummarySource[] {
  if (part.type !== 'component' || !isObject(part.data)) return [];
  const data = part.data as ComponentDataCandidate;
  if (
    data.tool !== 'web_search' ||
    stringValue(data.status)?.toLowerCase() !== 'success'
  ) {
    return [];
  }
  const output = stringValue(data.output);
  if (!output) return [];
  const updatedAt = message.updatedAt ?? message.createdAt;
  const sources: ChatTaskSummarySource[] = [];
  for (const match of output.matchAll(WEB_SEARCH_RESULT_PATTERN)) {
    const rawTitle = stringValue(match[1]);
    const url = httpUrl(match[2]);
    if (!url) continue;
    const title =
      rawTitle && rawTitle.toLowerCase() !== 'n/a'
        ? rawTitle
        : new URL(url).hostname;
    sources.push({
      id: `web:${url}`,
      kind: 'web_page',
      title: compactText(title, 160),
      description: url,
      resource: { type: 'url', url },
      messageId: message.id,
      updatedAt,
    });
  }
  return sources;
}

function httpUrl(value: unknown) {
  const url = stringValue(value);
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

export function collectLiveTaskSummary({
  messages,
  goal,
  todos,
  pending,
  running,
  agentNames,
}: {
  messages: TaskSummaryMessage[];
  goal?: ThreadGoal | null;
  todos?: TodoListSnapshot | null;
  pending?: TaskSummaryPending[];
  running?: TaskSummaryRuntimeItem[];
  agentNames?: ReadonlyMap<string, string>;
}): TaskSummaryLiveData {
  const contributions = messages.flatMap((message) => [
    ...(message.taskSummary?.version === 1 ? [message.taskSummary] : []),
    ...contentParts(message.content).flatMap(
      (part) => contributionFromPart(part) ?? [],
    ),
  ]);
  const messagePlans = messages.flatMap(
    (message) => extractPlan(message) ?? [],
  );
  const agentRuns = messages.flatMap((message) =>
    (message.agentRuns ?? [])
      .filter(
        (run) =>
          run.category?.trim().toLowerCase() === 'agent' &&
          Boolean(run.parentId),
      )
      .map((run) => ({
        id: run.id,
        parentId: run.parentId,
        level: agentRunLevel(run, messages),
        agentKey: run.agentKey,
        title:
          (run.agentKey ? agentNames?.get(run.agentKey) : undefined) ??
          run.title ??
          run.xpertName ??
          run.agentKey ??
          'Agent',
        status: taskSummaryAgentStatus(run.status),
        elapsedTime: run.elapsedTime,
        error:
          typeof run.error === 'string' ? compactText(run.error, 160) : undefined,
        messageId: message.id,
        updatedAt:
          run.updatedAt ?? run.endedAt ?? run.startedAt ?? message.updatedAt,
      })),
  );
  return {
    goal,
    plan: newest([
      ...contributions.flatMap((item) => item.plan ?? []),
      ...messagePlans,
    ]),
    todos: todos
      ? {
          componentId: todos.componentId,
          title: todos.title,
          items: todos.items,
          updatedAt: todos.endDate ?? todos.createdDate,
        }
      : newest(contributions.flatMap((item) => item.todos ?? [])),
    outputs: mergeLatest([
      ...contributions.flatMap((item) => item.outputs ?? []),
      ...messages.flatMap((message) =>
        contentParts(message.content).flatMap((part) =>
          knownPartOutputs(part, message),
        ),
      ),
    ]).filter(isCompletedOpenableOutput),
    sources: mergeLatest([
      ...contributions
        .flatMap((item) => item.sources ?? [])
        .filter((source) => source.kind !== 'sub_agent'),
      ...messages.flatMap((message) => [
        ...(message.references ?? []).map((reference) =>
          sourceFromReference(reference, message),
        ),
        ...fileSources(message.fileAssets, message),
        ...fileSources(message.attachments, message),
        ...contentParts(message.content).flatMap((part) =>
          webSearchSources(part, message),
        ),
      ]),
    ]),
    agents: mergeAgents(agentRuns),
    pending: pending ?? [],
    running: running ?? [],
  };
}

export function mergeTaskSummary(
  history: TaskSummarySnapshot | null,
  live: TaskSummaryLiveData,
  historySections?: Partial<{
    outputs: ChatTaskSummaryOutput[];
    sources: ChatTaskSummarySource[];
    agents: TaskSummaryAgent[];
    pending: TaskSummaryPending[];
  }>,
): MergedTaskSummary {
  const outputs = mergeLatest([
    ...(historySections?.outputs ?? history?.outputs.items ?? []),
    ...live.outputs,
  ]).filter(isCompletedOpenableOutput);
  const sources = mergeLatest([
    ...(historySections?.sources ?? history?.sources.items ?? []),
    ...live.sources,
  ]);
  const historyAgents = historySections?.agents ?? history?.agents.items ?? [];
  const eligibleHistoryAgents = historyAgents.filter((agent) =>
    Boolean(agent.parentId),
  );
  const excludedHistoryAgentCount =
    historyAgents.length - eligibleHistoryAgents.length;
  const historyAgentTotal = Math.max(
    0,
    (history?.agents.total ?? 0) - excludedHistoryAgentCount,
  );
  const agents = mergeAgents([...eligibleHistoryAgents, ...live.agents]);
  const pending = mergePending([
    ...(historySections?.pending ?? history?.pending.items ?? []),
    ...live.pending,
  ]);
  return {
    goal: live.goal ?? history?.task.goal,
    plan: newest(
      [history?.task.plan, live.plan].filter(
        (item): item is ChatTaskSummaryPlan => Boolean(item),
      ),
    ),
    todos: newest(
      [history?.task.todos, live.todos].filter(
        (item): item is ChatTaskSummaryTodos => Boolean(item),
      ),
    ),
    outputs,
    sources,
    agents,
    pending,
    running: live.running,
    totals: {
      outputs: Math.max(history?.outputs.total ?? 0, outputs.length),
      sources: Math.max(history?.sources.total ?? 0, sources.length),
      agents: Math.max(historyAgentTotal, agents.length),
      pending: Math.max(history?.pending.total ?? 0, pending.length),
    },
  };
}

function mergeLatest<T extends { id: string; updatedAt?: string }>(items: T[]) {
  const byId = new Map<string, T>();
  items.forEach((item) => {
    const current = byId.get(item.id);
    if (!current || timestamp(item.updatedAt) >= timestamp(current.updatedAt)) {
      byId.set(item.id, item);
    }
  });
  return [...byId.values()].sort(
    (left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt),
  );
}

function mergeAgents(items: TaskSummaryAgent[]) {
  const byAgent = new Map<string, TaskSummaryAgent>();
  items.forEach((item) => {
    const key = item.agentKey?.trim() || item.id;
    const current = byAgent.get(key);
    if (!current || timestamp(item.updatedAt) >= timestamp(current.updatedAt)) {
      byAgent.set(key, item);
    }
  });
  return [...byAgent.values()].sort(
    (left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt),
  );
}

function mergePending(items: TaskSummaryPending[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return [...byId.values()].sort(
    (left, right) => timestamp(right.createdAt) - timestamp(left.createdAt),
  );
}

function taskSummaryAgentStatus(
  status: string | undefined,
): TaskSummaryAgent['status'] {
  switch (status) {
    case 'running':
    case 'success':
    case 'error':
    case 'pending':
    case 'timeout':
    case 'interrupted':
      return status;
    default:
      return undefined;
  }
}

function newest<T extends { updatedAt?: string }>(items: T[]): T | undefined {
  return [...items].sort(
    (left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt),
  )[0];
}

function agentRunLevel(run: AgentRunInfo, messages: TaskSummaryMessage[]) {
  const byId = new Map(
    messages.flatMap((message) =>
      (message.agentRuns ?? []).map((item) => [item.id, item] as const),
    ),
  );
  let parentId = run.parentId;
  let level = 0;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    level += 1;
    parentId = byId.get(parentId)?.parentId;
  }
  return level;
}
