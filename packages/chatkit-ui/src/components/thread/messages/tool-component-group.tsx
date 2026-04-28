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
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Loader2,
  XCircle,
} from 'lucide-react';

import { type LocalizedText, resolveLocalizedText } from '../../../i18n/localized-text';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

/** Partial step data: during streaming, fields arrive incrementally */
export type PartialStepData = Partial<Omit<TMessageComponentStep, 'message' | 'title'>> & {
  category?: string;
  message?: LocalizedText;
  title?: LocalizedText;
};
type StepStatus = NonNullable<PartialStepData['status']>;
type ToolGroupDisplayStatus = Exclude<StepStatus, 'running'>;

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
type JsonObject = { [key: string]: JsonValue };
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

type DetectedJsonValue =
  | {
      kind: 'json';
      value: JsonValue;
      raw: string;
    }
  | {
      kind: 'text';
      text: string;
    };

const TOOL_CALL_OUTPUT_RENDERERS: Partial<Record<string, ToolCallOutputRenderer>> = {};

export function getToolStepData(content: TMessageContentComponent): PartialStepData {
  return (content.data ?? {}) as PartialStepData;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatDisplayValue(value: unknown) {
  return typeof value === 'string' ? value : safeJson(value);
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

function useToolStepDurationLabel(data: PartialStepData) {
  const [durationNow, setDurationNow] = React.useState(() => Date.now());
  const createdAt = parseStepDate(data.created_date);
  const endedAt = parseStepDate(data.end_date);
  const status = data.status;

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

function isJsonObjectValue(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canUseAsJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(canUseAsJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value).every(canUseAsJsonValue);
  }

  return false;
}

function parseJsonString(value: string): JsonValue | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const first = trimmed[0];
  if (first !== '{' && first !== '[') return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return canUseAsJsonValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function detectJsonValue(value: unknown): DetectedJsonValue {
  if (typeof value === 'string') {
    const parsed = parseJsonString(value);
    if (parsed !== null) {
      return {
        kind: 'json',
        value: parsed,
        raw: safeJson(parsed),
      };
    }

    return { kind: 'text', text: value };
  }

  if (canUseAsJsonValue(value) && value !== null && typeof value === 'object') {
    return {
      kind: 'json',
      value,
      raw: safeJson(value),
    };
  }

  return { kind: 'text', text: formatDisplayValue(value) };
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
    content.data?.category === 'Tool'
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

function getToolGroupDisplayStatus(items: TMessageContentComponent[]): ToolGroupDisplayStatus {
  if (items.some((item) => getToolStepData(item).status === 'fail')) {
    return 'fail';
  }

  return 'success';
}

export function getToolActivityLabel(content: TMessageContentComponent, language: string) {
  const data = getToolStepData(content);
  const runningCandidates = [data.message, data.title, data.tool, data.type];
  const completedCandidates = [data.title, data.message, data.tool, data.type];
  const candidates =
    data.status === 'running' ? runningCandidates : completedCandidates;

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

function getJsonValueSummary(value: JsonValue) {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (isJsonObjectValue(value)) {
    return `Object(${Object.keys(value).length})`;
  }

  return 'JSON';
}

function formatJsonPrimitive(value: string | number | boolean | null) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function JsonTreeNode({
  label,
  value,
  depth = 0,
}: {
  label?: string;
  value: JsonValue;
  depth?: number;
}) {
  const isArray = Array.isArray(value);
  const isObject = isJsonObjectValue(value);
  const isExpandable = isArray || isObject;
  const [isExpanded, setIsExpanded] = React.useState(depth < 2);

  if (!isExpandable) {
    return (
      <div className="flex min-w-0 gap-2 leading-6">
        {label ? (
          <span className="shrink-0 font-medium text-foreground/80">{label}:</span>
        ) : null}
        <span
          className={cn(
            'min-w-0 wrap-break-word',
            typeof value === 'string'
              ? 'text-emerald-700'
              : typeof value === 'number'
                ? 'text-blue-700'
                : typeof value === 'boolean'
                  ? 'text-purple-700'
                  : 'text-muted-foreground',
          )}
        >
          {formatJsonPrimitive(value)}
        </span>
      </div>
    );
  }

  const entries = isArray
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  const summary = isArray ? `Array(${value.length})` : `Object(${entries.length})`;

  return (
    <div className="min-w-0">
      <button
        type="button"
        className="flex min-w-0 items-center gap-1 leading-6 text-left hover:text-foreground"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90',
          )}
        />
        {label ? (
          <span className="min-w-0 truncate font-medium text-foreground/80">
            {label}:
          </span>
        ) : null}
        <span className="shrink-0 text-muted-foreground">{summary}</span>
      </button>
      {isExpanded ? (
        <div className="ml-4 border-l border-border/70 pl-3">
          {entries.map(([entryLabel, entryValue]) => (
            <JsonTreeNode
              key={entryLabel}
              label={entryLabel}
              value={entryValue}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function JsonTreeView({ value }: { value: JsonValue }) {
  return (
    <div className="min-w-0 font-mono text-[11px]">
      <JsonTreeNode value={value} />
    </div>
  );
}

function RawJsonBlock({ raw }: { raw: string }) {
  return (
    <pre className="whitespace-pre-wrap wrap-break-word font-mono text-[11px]">
      {raw}
    </pre>
  );
}

function PlainTextBlock({ value, destructive = false }: { value: string; destructive?: boolean }) {
  return (
    <pre
      className={cn(
        'whitespace-pre-wrap wrap-break-word',
        destructive && 'text-destructive',
      )}
    >
      {value}
    </pre>
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

function ToolCallRow({ content }: { content: TMessageContentComponent }) {
  const { i18n } = useChatkitTranslation();
  const data = getToolStepData(content);
  const status = data.status;
  const itemConfig = status ? toolStatusConfig[status] : null;
  const ItemStatusIcon = itemConfig?.icon;
  const hasError = status === 'fail' || Boolean(data.error);
  const label = getToolActivityLabel(content, i18n.language);
  const detailsId = React.useId();
  const hasDetails =
    data.input !== undefined ||
    data.error !== undefined ||
    data.output !== undefined;
  const durationLabel = useToolStepDurationLabel(data);
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
          'flex w-full min-w-0 items-center gap-2 text-left text-sm leading-6 text-muted-foreground',
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
        {ItemStatusIcon ? (
          <ItemStatusIcon
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              itemConfig?.iconClass,
              status === 'running' && 'animate-spin',
            )}
          />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate" title={label}>
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
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
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
}: {
  items: TMessageContentComponent[];
  hasFollowingItem: boolean;
}) {
  const { t } = useChatkitTranslation();
  const contentId = React.useId();
  const groupStatus = getToolGroupDisplayStatus(items);
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
        <ul id={contentId} className="mt-2 max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <ToolCallRow key={item.id ?? `tool-item-${index}`} content={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
