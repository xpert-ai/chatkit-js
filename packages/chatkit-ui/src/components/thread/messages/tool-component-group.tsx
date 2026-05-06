import * as React from 'react';

import type {
  TMessageComponentStep,
  TMessageComponentWidgetData,
  TMessageContentComplex,
  TMessageContentComponent,
  TMessageContentReasoning,
  TMessageContentText,
} from '@xpert-ai/chatkit-types';
import {
  BookOpen,
  Brain,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Copy,
  FileText,
  Files,
  Loader2,
  ListTodo,
  Network,
  Repeat2,
  SquareTerminal,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { type LocalizedText, resolveLocalizedText } from '../../../i18n/localized-text';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import {
  detectJsonValue,
  getJsonValueSummary,
  JsonTreeView,
  PlainTextBlock,
  RawJsonBlock,
} from '../json-tree-view';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { normalizeChatkitAvatar } from '../../ui/chatkit-avatar';

/** Partial step data: during streaming, fields arrive incrementally */
export type PartialStepData = Partial<Omit<TMessageComponentStep, 'message' | 'title'>> & {
  category?: string;
  message?: LocalizedText;
  title?: LocalizedText;
};
type StepStatus = NonNullable<PartialStepData['status']>;
type ToolGroupDisplayStatus = Exclude<StepStatus, 'running'>;
type ToolStepRunState = boolean | undefined;

type ToolGroupCategory =
  | 'files'
  | 'searches'
  | 'commands'
  | 'lists'
  | 'tasks'
  | 'knowledges'
  | 'tools';

export type ToolComponentRenderUnit =
  | {
      type: 'item';
      item: TMessageContentComplex | string;
      index: number;
    }
  | {
      type: 'tool-group';
      items: TMessageContentComponent[];
      startIndex: number;
    };

export const toolStatusConfig = {
  success: {
    iconClass: 'border-green-500 text-green-700',
    icon: CheckCircle2,
  },
  fail: {
    iconClass: 'border-red-500 text-red-700',
    icon: XCircle,
  },
  running: {
    iconClass: 'border-blue-500 text-blue-700',
    icon: Loader2,
  },
};

const TOOL_GROUP_CATEGORY_ORDER: ToolGroupCategory[] = [
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

type PendingToolComponent = {
  item: TMessageContentComponent;
  index: number;
};

type ToolCallOutputRendererProps = {
  content: TMessageContentComponent;
  data: PartialStepData;
};

type ToolCallOutputRenderer = React.ComponentType<ToolCallOutputRendererProps>;

const TOOL_CALL_OUTPUT_RENDERERS: Partial<Record<string, ToolCallOutputRenderer>> = {};

function normalizeStepCategory(category: unknown): string {
  if (typeof category !== 'string' || category.trim() === '') {
    return 'Tool';
  }

  return category;
}

export function getToolStepData(content: TMessageContentComponent): PartialStepData {
  const data = (content.data ?? {}) as PartialStepData;
  const category = normalizeStepCategory(data.category);

  if (category === data.category) {
    return data;
  }

  return {
    ...data,
    category,
  };
}

function parseStepDate(value: unknown): number | null {
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

function isThreadKnownIdle(isThreadRunning: ToolStepRunState) {
  return isThreadRunning === false;
}

export function getEffectiveToolStepStatus(
  data: PartialStepData,
  isThreadRunning?: ToolStepRunState,
): StepStatus | undefined {
  if (data.status === 'running' && isThreadKnownIdle(isThreadRunning)) {
    return 'fail';
  }

  return data.status;
}

function formatStepDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 10_000) {
    return `${(durationMs / 1_000).toFixed(1)}s`;
  }

  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1_000)}s`;
  }

  const hours = Math.floor(durationMs / 3_600_000);
  const minutes = Math.floor((durationMs % 3_600_000) / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function useFrozenTimestamp(shouldFreeze: boolean) {
  const [frozenAt, setFrozenAt] = React.useState<number | null>(() =>
    shouldFreeze ? Date.now() : null,
  );

  React.useEffect(() => {
    if (shouldFreeze) {
      setFrozenAt((current) => current ?? Date.now());
      return;
    }

    setFrozenAt(null);
  }, [shouldFreeze]);

  return frozenAt;
}

function useToolStepDurationLabel(
  data: PartialStepData,
  options?: {
    status?: StepStatus;
    fallbackEndedAt?: number | null;
  },
) {
  const [durationNow, setDurationNow] = React.useState(() => Date.now());
  const createdAt = parseStepDate(data.created_date);
  const explicitEndedAt = parseStepDate(data.end_date);
  const status = options?.status ?? data.status;
  const endedAt =
    explicitEndedAt ?? (status !== 'running' ? (options?.fallbackEndedAt ?? null) : null);

  React.useEffect(() => {
    if (status !== 'running' || createdAt === null || endedAt !== null) {
      return;
    }

    setDurationNow(Date.now());
    const timer = window.setInterval(() => {
      setDurationNow(Date.now());
    }, 100);

    return () => {
      window.clearInterval(timer);
    };
  }, [createdAt, endedAt, status]);

  if (createdAt === null) return null;

  const durationMs = Math.max(0, (endedAt ?? durationNow) - createdAt);
  return formatStepDuration(durationMs);
}

function isComponentContent(
  content: TMessageContentComplex,
): content is TMessageContentComponent {
  return content.type === 'component';
}

function isTextContent(content: TMessageContentComplex): content is TMessageContentText {
  return content.type === 'text';
}

function isReasoningContent(
  content: TMessageContentComplex,
): content is TMessageContentReasoning {
  return content.type === 'reasoning';
}

function isWidgetComponent(
  content: TMessageContentComponent,
): content is TMessageContentComponent<TMessageComponentWidgetData> {
  const data = content.data as Record<string, unknown> | undefined;
  return data?.type === 'Widget' && Array.isArray(data.widgets);
}

function isGroupableToolComponent(
  content: TMessageContentComplex | string | undefined,
): content is TMessageContentComponent {
  if (!content || typeof content === 'string') return false;
  return (
    isComponentContent(content) &&
    !isWidgetComponent(content) &&
    getToolStepData(content).category === 'Tool'
  );
}

function isSkippableToolGroupSeparator(
  content: TMessageContentComplex | string | undefined,
) {
  if (typeof content === 'string') return !content.trim();
  if (!content) return true;

  if (isTextContent(content)) {
    return !content.text?.trim();
  }

  if (isReasoningContent(content)) {
    return !content.text?.trim();
  }

  return false;
}

function normalizeToolToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || null;
}

function classifyToolToken(value: LocalizedText | unknown): ToolGroupCategory | null {
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
    normalized.startsWith('run_') ||
    normalized.includes('_run')
  ) {
    return 'commands';
  }
  if (normalized.includes('list')) return 'lists';
  if (normalized.includes('task') || normalized.includes('todo')) return 'tasks';
  if (normalized.includes('knowledge') || normalized.includes('retriever')) {
    return 'knowledges';
  }

  return null;
}

function getToolGroupCategory(content: TMessageContentComponent): ToolGroupCategory {
  const data = getToolStepData(content);
  return (
    classifyToolToken(data.type) ??
    classifyToolToken(data.tool) ??
    classifyToolToken(data.title) ??
    classifyToolToken(data.message) ??
    'tools'
  );
}

function getToolGroupCategoryCounts(
  items: TMessageContentComponent[],
): Partial<Record<ToolGroupCategory, number>> {
  return items.reduce<Partial<Record<ToolGroupCategory, number>>>((counts, item) => {
    const category = getToolGroupCategory(item);
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
}

function getEffectiveToolGroupDisplayStatus(
  items: TMessageContentComponent[],
  isThreadRunning?: ToolStepRunState,
): ToolGroupDisplayStatus {
  if (
    items.some((item) => {
      const data = getToolStepData(item);
      return (
        getEffectiveToolStepStatus(data, isThreadRunning) === 'fail' ||
        Boolean(data.error)
      );
    })
  ) {
    return 'fail';
  }

  return 'success';
}

export function getToolActivityLabel(
  content: TMessageContentComponent,
  language: string,
  statusOverride?: StepStatus,
) {
  const data = getToolStepData(content);
  const runningCandidates = [data.message, data.title, data.tool, data.type];
  const completedCandidates = [data.title, data.message, data.tool, data.type];
  const status = statusOverride ?? data.status;
  const candidates = status === 'running' ? runningCandidates : completedCandidates;

  for (const candidate of candidates) {
    const label = resolveLocalizedText(candidate, language);
    if (label) return label;
  }

  return 'Tool';
}

function flushPendingTools(
  units: ToolComponentRenderUnit[],
  pendingTools: PendingToolComponent[],
) {
  if (pendingTools.length === 0) return;

  units.push({
    type: 'tool-group',
    items: pendingTools.map((tool) => tool.item),
    startIndex: pendingTools[0].index,
  });

  pendingTools.length = 0;
}

export function buildToolComponentRenderUnits(
  content: Array<TMessageContentComplex | string | undefined>,
  options?: {
    shouldGroupComponent?: (content: TMessageContentComponent) => boolean;
  },
): ToolComponentRenderUnit[] {
  const units: ToolComponentRenderUnit[] = [];
  const pendingTools: PendingToolComponent[] = [];

  content.forEach((item, index) => {
    if (
      isGroupableToolComponent(item) &&
      options?.shouldGroupComponent?.(item) !== false
    ) {
      pendingTools.push({ item, index });
      return;
    }

    if (isSkippableToolGroupSeparator(item)) {
      return;
    }

    if (item === undefined) {
      return;
    }

    flushPendingTools(units, pendingTools);
    units.push({ type: 'item', item, index });
  });

  flushPendingTools(units, pendingTools);
  return units;
}

function getToolCallOutputRenderer(data: PartialStepData): ToolCallOutputRenderer {
  const keys = [data.tool, data.type].filter(
    (value): value is string => typeof value === 'string' && Boolean(value.trim()),
  );

  for (const key of keys) {
    const renderer = TOOL_CALL_OUTPUT_RENDERERS[key];
    if (renderer) return renderer;
  }

  return DefaultToolCallOutput;
}

function createToolsetIconUrl(
  toolset: unknown,
  organizationId?: string,
  apiUrl?: string,
) {
  const normalizedToolset = typeof toolset === 'string' ? toolset.trim() : '';
  if (!normalizedToolset) return null;

  const path = `/api/xpert-toolset/builtin-provider/${encodeURIComponent(
    normalizedToolset,
  )}/icon`;
  const params = new URLSearchParams();
  if (organizationId?.trim()) {
    params.set('org', organizationId.trim());
  }

  const normalizedApiUrl = typeof apiUrl === 'string' ? apiUrl.trim() : '';
  let baseUrl = '';
  if (normalizedApiUrl) {
    try {
      const url = new URL(normalizedApiUrl);
      baseUrl = `${url.origin}${path}`;
    } catch {
      baseUrl = path;
    }
  } else {
    baseUrl = path;
  }

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

function createToolsetAvatarUrl(toolsetId: unknown, apiUrl?: string) {
  const normalizedToolsetId = typeof toolsetId === 'string' ? toolsetId.trim() : '';
  if (!normalizedToolsetId) return null;

  const path = `/api/xpert-toolset/${encodeURIComponent(normalizedToolsetId)}/avatar`;
  const normalizedApiUrl = typeof apiUrl === 'string' ? apiUrl.trim() : '';

  if (!normalizedApiUrl) return path;

  try {
    const url = new URL(normalizedApiUrl);
    return `${url.origin}${path}`;
  } catch {
    return path;
  }
}

function shouldUseToolsetAvatar(toolset: unknown) {
  const normalized = normalizeToolToken(toolset);
  return normalized === 'mcp' || normalized === 'openapi';
}

function useToolsetAvatar(toolsetId: unknown, enabled: boolean, apiUrl?: string) {
  const avatarUrl = enabled ? createToolsetAvatarUrl(toolsetId, apiUrl) : null;
  const [avatar, setAvatar] = React.useState<unknown>(null);

  React.useEffect(() => {
    if (!avatarUrl) {
      setAvatar(null);
      return;
    }

    let cancelled = false;
    void fetch(avatarUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (!cancelled) setAvatar(value);
      })
      .catch(() => {
        if (!cancelled) setAvatar(null);
      });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  return normalizeChatkitAvatar(avatar);
}

function unicodeFromUnified(unified?: string): string | undefined {
  const normalized = typeof unified === 'string' ? unified.trim() : '';
  if (!normalized) return undefined;

  try {
    return normalized
      .split('-')
      .map((hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .join('');
  } catch {
    return undefined;
  }
}

function ToolAvatarIcon({
  avatar,
  label,
  className,
}: {
  avatar: NonNullable<ReturnType<typeof normalizeChatkitAvatar>>;
  label: string;
  className?: string;
}) {
  if (avatar.url) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={cn('rounded-sm object-cover', className)}
        data-slot="tool-step-icon"
        src={avatar.url}
      />
    );
  }

  const emoji = unicodeFromUnified(avatar.emoji?.unified);
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-sm text-[10px] leading-none',
          className,
        )}
        data-slot="tool-step-icon"
        style={avatar.background ? { background: avatar.background } : undefined}
        title={label}
      >
        {emoji}
      </span>
    );
  }

  return (
    <CircleHelp
      className={className}
      aria-hidden="true"
      data-slot="tool-step-icon"
    />
  );
}

function getKnownToolsetIcon(toolset: unknown): LucideIcon | null {
  const normalized = normalizeToolToken(toolset);
  if (!normalized) return null;

  switch (normalized) {
    case 'project':
      return Building2;
    case 'transfer_to':
      return Repeat2;
    case 'knowledge':
    case 'knowledgebase':
      return BookOpen;
    case 'project_tasks':
      return ListTodo;
    case 'memories':
      return Brain;
    case 'workflow_agent_tool':
      return Wrench;
    case 'workflow_task':
      return Network;
    default:
      return null;
  }
}

function getStepTypeIcon(type: unknown): LucideIcon | null {
  const normalized = normalizeToolToken(type);
  if (!normalized) return null;

  switch (normalized) {
    case 'file':
      return FileText;
    case 'files':
      return Files;
    case 'program':
      return SquareTerminal;
    case 'knowledges':
      return BookOpen;
    default:
      return null;
  }
}

function ToolStepIcon({
  data,
  className,
  organizationId,
  apiUrl,
}: {
  data: PartialStepData;
  className?: string;
  organizationId?: string;
  apiUrl?: string;
}) {
  const usesToolsetAvatar = shouldUseToolsetAvatar(data.toolset);
  const avatar = useToolsetAvatar(
    data.toolset_id,
    usesToolsetAvatar,
    apiUrl,
  );
  const iconUrl = createToolsetIconUrl(data.toolset, organizationId, apiUrl);
  const [failedIconUrl, setFailedIconUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFailedIconUrl(null);
  }, [iconUrl]);

  if (avatar) {
    return (
      <ToolAvatarIcon
        avatar={avatar}
        label={String(data.tool ?? data.toolset ?? 'Tool')}
        className={className}
      />
    );
  }

  if (iconUrl && failedIconUrl !== iconUrl) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={cn('rounded-sm object-contain', className)}
        data-slot="tool-step-icon"
        src={iconUrl}
        onError={() => setFailedIconUrl(iconUrl)}
      />
    );
  }

  const TypeIcon = getStepTypeIcon(data.type);
  if (TypeIcon) {
    return (
      <TypeIcon
        className={className}
        aria-hidden="true"
        data-slot="tool-step-icon"
      />
    );
  }

  const ToolsetIcon = getKnownToolsetIcon(data.toolset);
  if (ToolsetIcon) {
    return (
      <ToolsetIcon
        className={className}
        aria-hidden="true"
        data-slot="tool-step-icon"
      />
    );
  }

  if (usesToolsetAvatar) {
    return (
      <CircleHelp
        className={className}
        aria-hidden="true"
        data-slot="tool-step-icon"
      />
    );
  }

  return (
    <CircleHelp
      className={className}
      aria-hidden="true"
      data-slot="tool-step-icon"
    />
  );
}

function ToolCallCopyButton({ value }: { value: string }) {
  const { t } = useChatkitTranslation();
  const [isCopied, setIsCopied] = React.useState(false);
  const resetTimeoutRef = React.useRef<number | null>(null);

  const clearResetTimeout = React.useCallback(() => {
    if (resetTimeoutRef.current === null) return;
    window.clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = null;
  }, []);

  React.useEffect(() => clearResetTimeout, [clearResetTimeout]);

  const handleCopy = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;

    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setIsCopied(true);
        clearResetTimeout();
        resetTimeoutRef.current = window.setTimeout(() => {
          setIsCopied(false);
          resetTimeoutRef.current = null;
        }, 1500);
      })
      .catch(() => undefined);
  }, [clearResetTimeout, value]);

  const label = isCopied
    ? t('message.toolGroup.copied')
    : t('message.toolGroup.copy');

  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label={label}
      title={label}
      onClick={handleCopy}
    >
      {isCopied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function ToolCallValueBlock({
  value,
  destructive = false,
}: {
  value: unknown;
  destructive?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const detected = detectJsonValue(value);

  if (detected.kind === 'text') {
    return (
      <div className="min-w-0 space-y-1">
        <div className="flex justify-end">
          <ToolCallCopyButton value={detected.text} />
        </div>
        <PlainTextBlock value={detected.text} destructive={destructive} />
      </div>
    );
  }

  return (
    <Tabs defaultValue="tree" className="min-w-0">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          {t('message.toolGroup.jsonTitle')} · {getJsonValueSummary(detected.value)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <ToolCallCopyButton value={detected.raw} />
          <TabsList className="rounded-md p-0.5">
            <TabsTrigger className="px-2 py-0.5 text-[11px]" value="tree">
              {t('message.toolGroup.jsonTree')}
            </TabsTrigger>
            <TabsTrigger className="px-2 py-0.5 text-[11px]" value="raw">
              {t('message.toolGroup.jsonRaw')}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      <TabsContent value="tree" className="mt-0">
        <JsonTreeView value={detected.value} />
      </TabsContent>
      <TabsContent value="raw" className="mt-0">
        <RawJsonBlock raw={detected.raw} />
      </TabsContent>
    </Tabs>
  );
}

function DefaultToolCallOutput({ data }: ToolCallOutputRendererProps) {
  const { t } = useChatkitTranslation();
  const output = data.output ?? null;
  const error = data.error ?? null;

  if (error) {
    return (
      <div className="space-y-1">
        <div className="text-[11px] font-medium text-destructive">
          {t('message.toolGroup.errorTitle')}
        </div>
        <ToolCallValueBlock value={error} destructive />
      </div>
    );
  }

  if (output === null) return null;

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-muted-foreground">
        {t('message.toolGroup.outputTitle')}
      </div>
      <ToolCallValueBlock value={output} />
    </div>
  );
}

function ToolCallDetails({ content }: { content: TMessageContentComponent }) {
  const { t } = useChatkitTranslation();
  const data = getToolStepData(content);
  const OutputRenderer = getToolCallOutputRenderer(data);
  const hasInput = data.input !== undefined && data.input !== null;
  const hasOutput =
    data.error !== undefined ||
    data.output !== undefined;

  if (!hasInput && !hasOutput) return null;

  return (
    <div className="ml-6 mt-1 max-h-60 overflow-auto rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {hasInput && (
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">
            {t('message.toolGroup.inputTitle')}
          </div>
          <ToolCallValueBlock value={data.input} />
        </div>
      )}
      {hasInput && hasOutput ? <div className="h-2" /> : null}
      {hasOutput ? <OutputRenderer content={content} data={data} /> : null}
    </div>
  );
}

function ToolCallRow({
  content,
  isThreadRunning,
  organizationId,
  apiUrl,
}: {
  content: TMessageContentComponent;
  isThreadRunning?: ToolStepRunState;
  organizationId?: string;
  apiUrl?: string;
}) {
  const { i18n } = useChatkitTranslation();
  const data = getToolStepData(content);
  const status = getEffectiveToolStepStatus(data, isThreadRunning);
  const itemConfig = status ? toolStatusConfig[status] : null;
  const ItemStatusIcon = itemConfig?.icon;
  const hasError = status === 'fail' || Boolean(data.error);
  const label = getToolActivityLabel(content, i18n.language, status);
  const detailsId = React.useId();
  const hasDetails =
    data.input !== undefined ||
    data.error !== undefined ||
    data.output !== undefined;
  const fallbackEndedAt = useFrozenTimestamp(
    data.status === 'running' && status === 'fail',
  );
  const durationLabel = useToolStepDurationLabel(data, {
    status,
    fallbackEndedAt,
  });
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    if (status === 'running' && data.output !== undefined) {
      setIsExpanded(true);
    }
  }, [data.output, status]);

  return (
    <li className="min-w-0">
      <button
        type="button"
        className={cn(
          'group/tool-call flex w-full min-w-0 items-center gap-2 text-left text-sm leading-6 text-muted-foreground',
          hasDetails && 'cursor-pointer hover:text-foreground',
          hasError && 'text-destructive hover:text-destructive',
        )}
        aria-expanded={hasDetails ? isExpanded : undefined}
        aria-controls={hasDetails ? detailsId : undefined}
        disabled={!hasDetails}
        onClick={() => {
          if (hasDetails) setIsExpanded((prev) => !prev);
        }}
      >
        {status === 'running' && ItemStatusIcon ? (
          <ItemStatusIcon
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              itemConfig?.iconClass,
              'animate-spin',
            )}
          />
        ) : status ? (
          <ToolStepIcon
            data={data}
            organizationId={organizationId}
            apiUrl={apiUrl}
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              hasError ? 'text-destructive' : 'text-muted-foreground',
            )}
          />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
        {durationLabel ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
            {durationLabel}
          </span>
        ) : null}
        {hasDetails ? (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover/tool-call:opacity-100 group-focus-visible/tool-call:opacity-100',
              isExpanded && 'rotate-90',
            )}
          />
        ) : null}
      </button>
      {hasDetails && isExpanded ? (
        <div id={detailsId}>
          <ToolCallDetails content={content} />
        </div>
      ) : null}
    </li>
  );
}

export function ToolComponentGroup({
  items,
  hasFollowingItem,
  isThreadRunning,
  organizationId,
  apiUrl,
}: {
  items: TMessageContentComponent[];
  hasFollowingItem: boolean;
  isThreadRunning?: ToolStepRunState;
  organizationId?: string;
  apiUrl?: string;
}) {
  const { t } = useChatkitTranslation();
  const contentId = React.useId();
  const groupStatus = getEffectiveToolGroupDisplayStatus(items, isThreadRunning);
  const [isExpanded, setIsExpanded] = React.useState(!hasFollowingItem);
  const categoryCounts = getToolGroupCategoryCounts(items);
  const categorySummary = TOOL_GROUP_CATEGORY_ORDER.flatMap((category) => {
    const count = categoryCounts[category] ?? 0;
    if (count === 0) return [];

    return [
      t(
        `message.toolGroup.categories.${category}.${count === 1 ? 'one' : 'other'}`,
        { count },
      ),
    ];
  }).join(t('message.toolGroup.separator'));
  const summary = `${t(`message.toolGroup.status.${groupStatus}`)} ${categorySummary}`;
  const config = toolStatusConfig[groupStatus];
  const StatusIcon = config.icon;

  React.useEffect(() => {
    setIsExpanded(!hasFollowingItem);
  }, [hasFollowingItem, items.length]);

  return (
    <div className="px-1 py-1">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left opacity-60 hover:opacity-100 disabled:pointer-events-none data-[state=open]:bg-muted"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
          <StatusIcon
            className={cn(
              'h-4 w-4 shrink-0',
              config.iconClass,
            )}
          />
          <span className="truncate">{summary}</span>
        </div>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
      </button>

      {isExpanded && (
        <ul id={contentId} className="mt-2 space-y-1.5 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <ToolCallRow
              key={item.id ?? `tool-item-${index}`}
              content={item}
              isThreadRunning={isThreadRunning}
              organizationId={organizationId}
              apiUrl={apiUrl}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
