import * as React from 'react';

import {
  Bot,
  Braces,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GitBranch,
  Info,
  Loader2,
  MessageSquareText,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import type { AgentEventContent } from '../../../lib/agent-runs';
import {
  getAgentRunCounts,
  getAgentRunDuration,
  getAgentRunTitle,
  hasVisibleAgentRunDetails,
  isFailedRunStatus,
  isRunningRunStatus,
  normalizeRunStatus,
  type AgentRunRenderNode,
  type AssistantRenderUnit,
} from '../../../lib/agent-run-render-tree';
import { cn } from '../../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDisplayValue(value: unknown) {
  return typeof value === 'string' ? value : safeJson(value);
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

function getAgentRunStatusConfig(status?: string | null, hasReply = false) {
  const normalized = normalizeRunStatus(status);
  if (normalized === 'running') {
    return {
      icon: Loader2,
      iconClass: 'text-blue-700',
      labelKey: 'running',
      spin: true,
    };
  }

  if (normalized === 'success' || normalized === 'succeeded') {
    return {
      icon: CheckCircle2,
      iconClass: 'text-green-700',
      labelKey: 'success',
      spin: false,
    };
  }

  if (isFailedRunStatus(normalized)) {
    return {
      icon: XCircle,
      iconClass: 'text-red-700',
      labelKey: 'error',
      spin: false,
    };
  }

  if (normalized === 'pending' && hasReply) {
    return {
      icon: CheckCircle2,
      iconClass: 'text-green-700',
      labelKey: 'replied',
      spin: false,
    };
  }

  return {
    icon: Clock3,
    iconClass: 'text-muted-foreground',
    labelKey: normalized,
    spin: false,
  };
}

function AgentRunHeaderMetric({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={label}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm text-[11px] text-muted-foreground/60 transition-colors group-hover/agent:text-muted-foreground"
        >
          <Icon className="h-3.5 w-3.5" />
          {value !== undefined ? <span>{value}</span> : null}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-80 text-left">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function getAgentNodeUnits(node: AgentRunRenderNode): AssistantRenderUnit[] {
  return [
    ...node.entries.map((entry) => ({
      type: 'entry' as const,
      entry,
      order: entry.order,
    })),
    ...node.children.map((child) => ({
      type: 'agent' as const,
      node: child,
      order: child.firstOrder,
    })),
  ].sort((a, b) => a.order - b.order);
}

export function AgentEventRow({ content }: { content: AgentEventContent }) {
  const label =
    content.title?.trim() ||
    content.message?.trim() ||
    content.event?.trim() ||
    'Event';
  const detail =
    content.title?.trim() && content.message?.trim()
      ? content.message.trim()
      : null;
  const isError =
    content.error !== undefined || isFailedRunStatus(content.status);

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md px-2 py-1.5 text-xs leading-5',
        isError
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted/40 text-muted-foreground',
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{label}</div>
        {detail ? <div className="wrap-break-word">{detail}</div> : null}
        {content.error !== undefined ? (
          <pre className="mt-1 whitespace-pre-wrap wrap-break-word">
            {formatDisplayValue(content.error)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export function AgentRunGroup({
  node,
  hasFollowingItem,
  depth,
  renderUnits,
}: {
  node: AgentRunRenderNode;
  hasFollowingItem: boolean;
  depth: number;
  renderUnits: (
    units: AssistantRenderUnit[],
    depth: number,
  ) => React.ReactNode;
}) {
  const { t } = useChatkitTranslation();
  const counts = getAgentRunCounts(node);
  const statusConfig = getAgentRunStatusConfig(
    node.info.status,
    counts.text > 0,
  );
  const StatusIcon = statusConfig.icon;
  const isRunning = isRunningRunStatus(node.info.status);
  const [isExpanded, setIsExpanded] = React.useState(
    () => isRunning || !hasFollowingItem,
  );
  const title = getAgentRunTitle(node.info, t('message.agentRun.defaultTitle'));
  const duration = getAgentRunDuration(node.info);
  const statusLabel = t(`message.agentRun.status.${statusConfig.labelKey}`, {
    defaultValue: node.info.status ?? statusConfig.labelKey,
  });
  const detailsId = React.useId();

  React.useEffect(() => {
    if (isRunning) {
      setIsExpanded(true);
      return;
    }
    setIsExpanded(!hasFollowingItem);
  }, [hasFollowingItem, isRunning]);

  const countItems = [
    counts.text > 0
      ? {
          icon: MessageSquareText,
          count: counts.text,
          label: t(
            `message.agentRun.counts.messages.${counts.text === 1 ? 'one' : 'other'}`,
            { count: counts.text },
          ),
        }
      : null,
    counts.tools > 0
      ? {
          icon: Wrench,
          count: counts.tools,
          label: t(
            `message.agentRun.counts.tools.${counts.tools === 1 ? 'one' : 'other'}`,
            { count: counts.tools },
          ),
        }
      : null,
    counts.events > 0
      ? {
          icon: Info,
          count: counts.events,
          label: t(
            `message.agentRun.counts.events.${counts.events === 1 ? 'one' : 'other'}`,
            { count: counts.events },
          ),
        }
      : null,
    counts.children > 0
      ? {
          icon: GitBranch,
          count: counts.children,
          label: t(
            `message.agentRun.counts.children.${counts.children === 1 ? 'one' : 'other'}`,
            { count: counts.children },
          ),
        }
      : null,
  ].filter(
    (
      item,
    ): item is {
      icon: LucideIcon;
      label: string;
      count: number;
    } => Boolean(item),
  );

  return (
    <div className={cn('border-l border-border/70 pl-2', depth > 0 ? 'ml-1' : '-mx-2.5')}>
      <button
        type="button"
        className="group/agent group-agent flex w-full items-start justify-between gap-2 rounded-md px-0 py-1.5 text-left"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <Bot className="h-4 w-4 shrink-0 text-muted-foreground/55 transition-colors group-hover/agent:text-muted-foreground" />
            <span className="min-w-0 max-w-[16rem] truncate text-sm font-medium text-foreground/65 transition-colors group-hover/agent:text-foreground">
              {title}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/65 transition-colors group-hover/agent:text-muted-foreground">
              <StatusIcon
                className={cn(
                  'h-3.5 w-3.5',
                  statusConfig.iconClass,
                  statusConfig.spin && 'animate-spin',
                )}
              />
              {statusLabel}
            </span>
            {duration !== null ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground/60 tabular-nums transition-colors group-hover/agent:text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                {formatStepDuration(duration)}
              </span>
            ) : null}
            {node.info.inputs !== undefined ? (
              <AgentRunHeaderMetric
                icon={Braces}
                label={t('message.agentRun.inputLabel')}
              >
                <div className="space-y-1">
                  <div className="font-medium">
                    {t('message.agentRun.inputLabel')}
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap wrap-break-word text-xs">
                    {formatDisplayValue(node.info.inputs)}
                  </pre>
                </div>
              </AgentRunHeaderMetric>
            ) : null}
            {countItems.map((item) => {
              const CountIcon = item.icon;
              return (
                <AgentRunHeaderMetric
                  key={item.label}
                  icon={CountIcon}
                  label={item.label}
                  value={item.count}
                >
                  <span>{item.label}</span>
                </AgentRunHeaderMetric>
              );
            })}
          </div>
        </div>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/55 opacity-0 transition-[color,transform] group-hover/agent:text-muted-foreground group-hover/agent:opacity-100',
            isExpanded && 'rotate-90',
          )}
        />
      </button>

      {isExpanded ? (
        <div id={detailsId} className="mt-2 space-y-3">
          {hasVisibleAgentRunDetails(node.info) ? (
            <div className="space-y-2 rounded-md bg-muted/30 px-2 py-2 text-xs text-muted-foreground">
              {node.info.error !== undefined ? (
                <div>
                  <div className="mb-1 font-medium text-destructive">
                    {t('message.agentRun.errorLabel')}
                  </div>
                  <pre className="whitespace-pre-wrap wrap-break-word text-destructive">
                    {formatDisplayValue(node.info.error)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
          {renderUnits(getAgentNodeUnits(node), depth + 1)}
        </div>
      ) : null}
    </div>
  );
}
