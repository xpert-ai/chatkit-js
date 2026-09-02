import * as React from 'react';
import {
  Bot,
  BookOpen,
  CheckCircle2,
  CircleEllipsis,
  ExternalLink,
  FileOutput,
  ListChecks,
  Loader2,
  PlayCircle,
  RotateCcw,
  Target,
} from 'lucide-react';
import type { ChatTaskSummaryResourceReference } from '@xpert-ai/chatkit-types';
import type {
  MergedTaskSummary,
  TaskSummarySection,
} from '../../lib/task-summary';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const PREVIEW_SIZE = 3;

export type TaskSummaryProps = {
  summary: MergedTaskSummary;
  historyError?: unknown;
  loadingSections?: Partial<Record<TaskSummarySection, boolean>>;
  loadedSectionCounts?: Record<TaskSummarySection, number>;
  onRetryHistory: () => void;
  onLoadSection: (section: TaskSummarySection) => void;
  onNavigateMessage: (messageId: string) => void;
  onFocusComposer: () => void;
  onOpenResource: (
    resource: ChatTaskSummaryResourceReference,
    messageId?: string,
    title?: string,
  ) => void;
};

type TaskSummaryTriggerProps = TaskSummaryProps & {
  displayMode?: 'popover' | 'docked';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function TaskSummaryTrigger({
  displayMode = 'popover',
  open: controlledOpen,
  onOpenChange,
  ...props
}: TaskSummaryTriggerProps) {
  const { t } = useChatkitTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );
  const triggerButton = (
    <button
      type="button"
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground"
      aria-label={t('taskSummary.open')}
      aria-expanded={open}
      onClick={displayMode === 'docked' ? () => setOpen(!open) : undefined}
    >
      <ListChecks size={16} />
    </button>
  );

  if (displayMode === 'docked') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
        <TooltipContent side="bottom">{t('taskSummary.open')}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('taskSummary.open')}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-2rem))] max-h-[min(44rem,calc(100vh-5rem))] overflow-y-auto rounded-2xl border-border/70 bg-popover p-0 shadow-lg"
        aria-label={t('taskSummary.title')}
      >
        <TaskSummaryContent {...props} />
      </PopoverContent>
    </Popover>
  );
}

export function TaskSummaryPanel({
  className,
  ...props
}: TaskSummaryProps & { className?: string }) {
  const { t } = useChatkitTranslation();

  return (
    <aside
      data-slot="task-summary-panel"
      aria-label={t('taskSummary.title')}
      className={cn(
        'h-fit max-h-full overflow-y-auto rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-lg',
        className,
      )}
    >
      <TaskSummaryContent {...props} />
    </aside>
  );
}

function TaskSummaryContent({
  summary,
  historyError,
  loadingSections = {},
  loadedSectionCounts = { outputs: 0, sources: 0, agents: 0, pending: 0 },
  onRetryHistory,
  onLoadSection,
  onNavigateMessage,
  onFocusComposer,
  onOpenResource,
}: TaskSummaryProps) {
  const { t } = useChatkitTranslation();
  const [expanded, setExpanded] = React.useState<
    Partial<Record<TaskSummarySection, boolean>>
  >({});
  const [expandedLocal, setExpandedLocal] = React.useState<
    Partial<Record<'todos' | 'running', boolean>>
  >({});
  const hasTask = Boolean(
    summary.goal || summary.plan || summary.todos?.items.length,
  );

  const toggleSection = (section: TaskSummarySection) => {
    if (expanded[section]) {
      setExpanded((state) => ({ ...state, [section]: false }));
      return;
    }
    setExpanded((state) => ({ ...state, [section]: true }));
    if (loadedSectionCounts[section] === 0) {
      void onLoadSection(section);
    }
  };

  const sectionItems = <T,>(section: TaskSummarySection, items: T[]) =>
    expanded[section] ? items : items.slice(0, PREVIEW_SIZE);

  const localSectionItems = <T,>(section: 'todos' | 'running', items: T[]) =>
    expandedLocal[section] ? items : items.slice(0, PREVIEW_SIZE);

  const localizedStatus = (status?: string) => {
    if (!status) return undefined;
    const key = status
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return t(`taskSummary.status.${key}`, { defaultValue: status });
  };

  const openSummaryItem = (
    resource: ChatTaskSummaryResourceReference | undefined,
    messageId: string | undefined,
    title: string,
  ) => {
    if (resource?.type === 'message') {
      onNavigateMessage(resource.messageId);
      return;
    }
    if (resource) {
      onOpenResource(resource, messageId, title);
      return;
    }
    if (messageId) {
      onNavigateMessage(messageId);
    }
  };

  const sectionAction = (section: TaskSummarySection, total: number) => {
    if (total <= PREVIEW_SIZE && !expanded[section]) return null;
    const loading = loadingSections[section];
    const canLoadMore =
      Boolean(expanded[section]) && loadedSectionCounts[section] < total;
    return (
      <button
        type="button"
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        disabled={loading}
        onClick={() =>
          canLoadMore ? void onLoadSection(section) : toggleSection(section)
        }
      >
        {loading && <Loader2 className="size-3 animate-spin" />}
        {!loading && <ListChecks className="size-3.5" />}
        {canLoadMore
          ? t('taskSummary.loadMore')
          : expanded[section]
            ? t('taskSummary.collapse')
            : t('taskSummary.viewAll', { count: total })}
      </button>
    );
  };

  const localSectionAction = (section: 'todos' | 'running', total: number) => {
    if (total <= PREVIEW_SIZE) return null;
    const isExpanded = Boolean(expandedLocal[section]);
    return (
      <button
        type="button"
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        onClick={() =>
          setExpandedLocal((state) => ({
            ...state,
            [section]: !isExpanded,
          }))
        }
      >
        <ListChecks className="size-3.5" />
        {isExpanded
          ? t('taskSummary.collapse')
          : t('taskSummary.viewAll', { count: total })}
      </button>
    );
  };

  return (
    <div className="divide-y divide-border/70">
      {Boolean(historyError) && (
        <div className="m-3 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span>{t('taskSummary.historyError')}</span>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline"
            onClick={onRetryHistory}
          >
            <RotateCcw className="size-3" />
            {t('taskSummary.retry')}
          </button>
        </div>
      )}

      <SummarySection title={t('taskSummary.sections.outputs')}>
        {summary.outputs.length === 0 ? (
          <SummaryPrompt onClick={onFocusComposer}>
            {t('taskSummary.createOutput')}
          </SummaryPrompt>
        ) : (
          sectionItems('outputs', summary.outputs).map((item) => (
            <SummaryButton
              key={item.id}
              title={item.title}
              metadata={localizedStatus(item.status)}
              description={item.description}
              leading={<FileOutput className="size-4" />}
              trailing={
                item.resource && item.resource.type !== 'message' ? (
                  <ExternalLink className="size-3.5" />
                ) : undefined
              }
              onClick={() =>
                openSummaryItem(item.resource, item.messageId, item.title)
              }
            />
          ))
        )}
        {sectionAction('outputs', summary.totals.outputs)}
      </SummarySection>

      <SummarySection title={t('taskSummary.sections.sources')}>
        {sectionItems('sources', summary.sources).map((item) => (
          <SummaryButton
            key={item.id}
            title={item.title}
            description={item.description}
            leading={<BookOpen className="size-4" />}
            trailing={
              item.resource && item.resource.type !== 'message' ? (
                <ExternalLink className="size-3.5" />
              ) : undefined
            }
            onClick={() =>
              openSummaryItem(item.resource, item.messageId, item.title)
            }
          />
        ))}
        {sectionAction('sources', summary.totals.sources)}
      </SummarySection>

      {hasTask && (
        <SummarySection title={t('taskSummary.sections.task')}>
          {summary.goal && (
            <SummaryButton
              title={summary.goal.objective}
              metadata={localizedStatus(summary.goal.status)}
              leading={<Target className="size-4" />}
              onClick={onFocusComposer}
            />
          )}
          {summary.plan && (
            <SummaryButton
              title={summary.plan.title}
              description={summary.plan.excerpt}
              leading={<ListChecks className="size-4" />}
              onClick={() =>
                summary.plan?.messageId
                  ? onNavigateMessage(summary.plan.messageId)
                  : onFocusComposer()
              }
            />
          )}
          {localSectionItems('todos', summary.todos?.items ?? []).map(
            (todo) => (
              <SummaryButton
                key={todo.id}
                title={todo.content}
                metadata={localizedStatus(todo.status)}
                leading={
                  todo.status === 'completed' ? (
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  ) : (
                    <CircleEllipsis className="size-4 text-muted-foreground" />
                  )
                }
                onClick={() =>
                  summary.todos?.messageId
                    ? onNavigateMessage(summary.todos.messageId)
                    : onFocusComposer()
                }
              />
            ),
          )}
          {localSectionAction('todos', summary.todos?.items.length ?? 0)}
        </SummarySection>
      )}

      {summary.running.length > 0 && (
        <SummarySection title={t('taskSummary.sections.running')}>
          {localSectionItems('running', summary.running).map((item) => (
            <SummaryButton
              key={item.id}
              title={item.title}
              metadata={localizedStatus(item.status)}
              description={item.description}
              leading={<PlayCircle className="size-4" />}
              trailing={
                item.resource ? (
                  <ExternalLink className="size-3.5" />
                ) : undefined
              }
              onClick={() =>
                item.resource &&
                onOpenResource(item.resource, undefined, item.title)
              }
            />
          ))}
          {localSectionAction('running', summary.running.length)}
        </SummarySection>
      )}

      {summary.agents.length > 0 && (
        <SummarySection title={t('taskSummary.sections.agents')}>
          {sectionItems('agents', summary.agents).map((item) => (
            <SummaryButton
              key={item.id}
              title={item.title}
              metadata={[
                localizedStatus(item.status),
                formatElapsed(item.elapsedTime),
              ]
                .filter(Boolean)
                .join(' · ')}
              description={item.error}
              leading={<Bot className="size-4" />}
              onClick={() =>
                item.messageId
                  ? onNavigateMessage(item.messageId)
                  : onFocusComposer()
              }
            />
          ))}
          {sectionAction('agents', summary.totals.agents)}
        </SummarySection>
      )}

      {summary.pending.length > 0 && (
        <SummarySection title={t('taskSummary.sections.pending')}>
          {sectionItems('pending', summary.pending).map((item) => (
            <SummaryButton
              key={item.id}
              title={item.title}
              description={item.description}
              leading={<CircleEllipsis className="size-4" />}
              onClick={() =>
                item.messageId
                  ? onNavigateMessage(item.messageId)
                  : onFocusComposer()
              }
            />
          ))}
          {sectionAction('pending', summary.totals.pending)}
        </SummarySection>
      )}
    </div>
  );
}

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="px-4 py-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </section>
  );
}

function SummaryPrompt({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="block rounded-md py-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SummaryButton({
  title,
  metadata,
  description,
  leading,
  trailing,
  onClick,
}: {
  title: string;
  metadata?: string;
  description?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const tooltipText = [title, metadata, description].filter(Boolean);
  return (
    <button
      type="button"
      title={tooltipText.join('\n')}
      aria-disabled={!onClick}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      className={cn(
        'flex w-full min-w-0 items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
        onClick &&
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        !onClick && 'cursor-default',
      )}
    >
      {leading && (
        <span className="mt-0.5 shrink-0 text-muted-foreground">{leading}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-5 text-foreground">
          {title}
        </span>
        {metadata && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {metadata}
          </span>
        )}
        {description && (
          <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      {trailing && (
        <span className="mt-0.5 text-muted-foreground">{trailing}</span>
      )}
    </button>
  );
}

function formatElapsed(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}
