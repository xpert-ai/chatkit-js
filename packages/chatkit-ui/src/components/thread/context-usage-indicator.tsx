import * as React from 'react';

import { cn } from '../../lib/utils';
import { useStreamContext } from '../../providers/Stream';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  getThreadContextUsage,
  getThreadContextUsageTotalTokens,
  normalizeContextUsageNumber,
  resolveUsedContextSize,
} from '../../lib/thread-context-usage';
import { ProgressCircle } from '../ui/progress-circle';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type ContextUsageIndicatorProps = {
  label?: string;
  className?: string;
};

const kNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function normalizeAgentKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function resolveAssistantContextSize(assistant: {
  metadata?: Record<string, unknown> | null;
  config?: { configurable?: Record<string, unknown> } | null;
}): number | null {
  return (
    normalizeContextUsageNumber(assistant.metadata?.context_size) ??
    normalizeContextUsageNumber(assistant.config?.configurable?.context_size)
  );
}

function resolveAssistantAgentKey(assistant: {
  metadata?: Record<string, unknown> | null;
  config?: { configurable?: Record<string, unknown> } | null;
}): string | null {
  return (
    normalizeAgentKey(assistant.metadata?.agent_key) ??
    normalizeAgentKey(assistant.config?.configurable?.agentKey)
  );
}

function clampUsage(value: number | null, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(Math.floor(value), max);
}

function formatCountInK(value: number): string {
  return `${kNumberFormatter.format(value / 1000)}k`;
}

export function ContextUsageIndicator({
  label,
  className,
}: ContextUsageIndicatorProps) {
  const { t } = useChatkitTranslation();
  const stream = useStreamContext();
  const [maxContextSize, setMaxContextSize] = React.useState<number | null>(
    null,
  );
  const [usedContextSize, setUsedContextSize] = React.useState<number | null>(
    null,
  );
  const [assistantAgentKey, setAssistantAgentKey] = React.useState<
    string | null
  >(null);
  const latestRealtimeUsageRef = React.useRef<{
    threadId: string | null;
    agentKey: string | null;
    usedTokens: number | null;
  }>({
    threadId: null,
    agentKey: null,
    usedTokens: null,
  });

  const realtimeUsage = React.useMemo(
    () =>
      getThreadContextUsage(stream.contextUsageByAgentKey, assistantAgentKey),
    [assistantAgentKey, stream.contextUsageByAgentKey],
  );
  const realtimeUsedContextSize =
    getThreadContextUsageTotalTokens(realtimeUsage);
  const hasApiConfiguration = Boolean(
    stream.apiUrl?.trim() && stream.apiKey?.trim(),
  );

  React.useEffect(() => {
    if (!hasApiConfiguration || !stream.client || !stream.assistantId) {
      setMaxContextSize(null);
      setAssistantAgentKey(null);
      return;
    }

    let cancelled = false;
    stream.client.assistants
      .get(stream.assistantId)
      .then((assistant) => {
        if (cancelled || !assistant) return;
        setMaxContextSize(resolveAssistantContextSize(assistant));
        setAssistantAgentKey(resolveAssistantAgentKey(assistant));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Chat] Failed to load assistant context size:', err);
        setAssistantAgentKey(null);
      });

    return () => {
      cancelled = true;
    };
  }, [hasApiConfiguration, stream.client, stream.assistantId]);

  React.useEffect(() => {
    latestRealtimeUsageRef.current = {
      threadId: stream.threadId ?? null,
      agentKey: assistantAgentKey,
      usedTokens: realtimeUsedContextSize,
    };
  }, [assistantAgentKey, realtimeUsedContextSize, stream.threadId]);

  React.useEffect(() => {
    if (realtimeUsedContextSize == null) return;
    setUsedContextSize(realtimeUsedContextSize);
  }, [realtimeUsedContextSize]);

  React.useEffect(() => {
    if (!hasApiConfiguration || !stream.client) {
      setUsedContextSize(null);
      return;
    }
    if (!stream.threadId) {
      setUsedContextSize(0);
      return;
    }
    if (realtimeUsedContextSize != null) return;
    if (stream.isLoading) return;

    let cancelled = false;
    const requestThreadId = stream.threadId;
    const requestAgentKey = assistantAgentKey;
    stream.client.threads
      .getContextUsage(
        requestThreadId,
        requestAgentKey ? { agentKey: requestAgentKey } : undefined,
      )
      .then((result) =>
        normalizeContextUsageNumber(result?.usage?.context_tokens),
      )
      .then((result) => {
        if (cancelled) return;
        const latestRealtimeUsage = latestRealtimeUsageRef.current;
        if (
          latestRealtimeUsage.usedTokens != null &&
          latestRealtimeUsage.threadId === requestThreadId &&
          latestRealtimeUsage.agentKey === requestAgentKey
        ) {
          return;
        }
        setUsedContextSize(
          resolveUsedContextSize({
            fallbackUsedTokens: result,
          }),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Chat] Failed to load thread context usage:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [
    assistantAgentKey,
    hasApiConfiguration,
    realtimeUsedContextSize,
    stream.apiKey,
    stream.apiUrl,
    stream.client,
    stream.threadId,
    stream.isLoading,
  ]);

  if (
    typeof maxContextSize !== 'number' ||
    !Number.isFinite(maxContextSize) ||
    maxContextSize <= 0
  ) {
    return null;
  }

  const max = Math.floor(maxContextSize);
  const used = clampUsage(usedContextSize, max);
  const percent = Math.max(0, Math.min(100, (used / max) * 100));
  const roundedPercent = Math.round(percent);
  const remainingPercent = Math.max(0, 100 - roundedPercent);
  const formattedUsed = formatCountInK(used);
  const formattedMax = formatCountInK(max);
  const usageLabel = label ?? t('chat.contextUsage.label');
  const usageFullLabel = t('chat.contextUsage.full', {
    usedPercent: roundedPercent,
    remainingPercent,
  });
  const usageTokensLabel = t('chat.contextUsage.tokensUsed', {
    used: formattedUsed,
    max: formattedMax,
  });
  const usageLabelWithSuffix = usageLabel.endsWith(':')
    ? usageLabel
    : `${usageLabel}:`;
  const progressClassName =
    percent >= 90
      ? 'text-destructive'
      : percent >= 75
        ? 'text-amber-500'
        : 'text-primary dark:text-zinc-300';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
            className,
          )}
          aria-label={`${usageLabelWithSuffix} ${usageFullLabel}. ${usageTokensLabel}`}
        >
          <ProgressCircle
            value={percent}
            className={cn('size-5', progressClassName)}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="space-y-0.5 px-3 py-2 text-center"
      >
        <div className="text-primary-foreground/70">{usageLabelWithSuffix}</div>
        <div className="font-medium text-primary-foreground/80">
          {usageFullLabel}
        </div>
        <div className="text-sm font-semibold">{usageTokensLabel}</div>
      </TooltipContent>
    </Tooltip>
  );
}
