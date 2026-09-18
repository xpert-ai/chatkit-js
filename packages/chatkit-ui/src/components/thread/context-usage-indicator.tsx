import * as React from 'react';
import { CircleHelp } from 'lucide-react';

import { cn } from '../../lib/utils';
import { useStreamContext } from '../../providers/Stream';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  getThreadContextUsage,
  getThreadContextUsageTotalTokens,
  normalizeContextUsageNumber,
  readStoredContextUsage,
  type ContextUsageMeasurement,
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
  const [assistantContext, setAssistantContext] = React.useState<{
    assistantId: string;
    maxContextSize: number | null;
    agentKey: string | null;
  } | null>(null);
  const assistantReady = assistantContext?.assistantId === stream.assistantId;
  const assistantAgentKey = assistantReady
    ? (assistantContext?.agentKey ?? null)
    : null;
  const maxContextSize = assistantReady
    ? (assistantContext?.maxContextSize ?? null)
    : null;
  const scope = React.useMemo(
    () => ({
      threadId: stream.threadId ?? null,
      assistantId: stream.assistantId,
      agentKey: assistantAgentKey,
    }),
    [stream.threadId, stream.assistantId, assistantAgentKey],
  );
  const [measurement, setMeasurement] = React.useState<
    (ContextUsageMeasurement & { scope: typeof scope }) | null
  >(null);

  const realtimeUsage = React.useMemo(() => {
    const usage = getThreadContextUsage(
      stream.contextUsageByAgentKey,
      assistantAgentKey,
    );
    return usage?.threadId === scope.threadId ? usage : null;
  }, [assistantAgentKey, scope.threadId, stream.contextUsageByAgentKey]);
  const realtimeUsedContextSize =
    getThreadContextUsageTotalTokens(realtimeUsage);
  const latestRealtimeUsageRef = React.useRef(realtimeUsage);
  const hasApiConfiguration = Boolean(
    stream.apiUrl?.trim() && stream.apiKey?.trim(),
  );

  React.useEffect(() => {
    if (!hasApiConfiguration || !stream.client || !stream.assistantId) {
      setAssistantContext(null);
      return;
    }

    let cancelled = false;
    stream.client.assistants
      .get(stream.assistantId)
      .then((assistant) => {
        if (cancelled || !assistant) return;
        setAssistantContext({
          assistantId: stream.assistantId,
          maxContextSize: resolveAssistantContextSize(assistant),
          agentKey: resolveAssistantAgentKey(assistant),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Chat] Failed to load assistant context size:', err);
        setAssistantContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [hasApiConfiguration, stream.client, stream.assistantId]);

  React.useEffect(() => {
    latestRealtimeUsageRef.current = realtimeUsage;
    if (realtimeUsedContextSize == null || realtimeUsedContextSize === 0)
      return;
    setMeasurement({
      scope,
      usedTokens: realtimeUsedContextSize,
      status: 'current',
    });
  }, [scope, realtimeUsage, realtimeUsedContextSize]);

  React.useEffect(() => {
    if (!hasApiConfiguration || !stream.client || !assistantReady) {
      return;
    }
    if (!scope.threadId) {
      setMeasurement({ scope, usedTokens: 0, status: 'current' });
      return;
    }
    if (stream.isLoading) return;

    let cancelled = false;
    const realtimeAtRequest = latestRealtimeUsageRef.current;
    stream.client.threads
      .getContextUsage(
        scope.threadId,
        scope.agentKey ? { agentKey: scope.agentKey } : undefined,
      )
      .then((result) => {
        if (cancelled || latestRealtimeUsageRef.current !== realtimeAtRequest)
          return;
        const stored = readStoredContextUsage(result);
        const realtimeTokens =
          getThreadContextUsageTotalTokens(realtimeAtRequest);
        const sameRun =
          realtimeAtRequest &&
          (!result.run_id || result.run_id === realtimeAtRequest.runId);
        setMeasurement((previous) => {
          const previousTokens =
            previous?.scope === scope ? previous.usedTokens : null;
          const usedTokens =
            stored.usedTokens == null
              ? previousTokens
              : sameRun && realtimeTokens != null && realtimeTokens > 0
                ? realtimeTokens
                : stored.usedTokens;
          return {
            scope,
            usedTokens,
            status:
              stored.status === 'unavailable' && usedTokens != null
                ? 'stale'
                : stored.status,
          };
        });
      })
      .catch((err) => {
        if (cancelled || latestRealtimeUsageRef.current !== realtimeAtRequest)
          return;
        console.warn('[Chat] Failed to load thread context usage:', err);
        setMeasurement((previous) => {
          const usedTokens =
            previous?.scope === scope ? previous.usedTokens : null;
          return {
            scope,
            usedTokens,
            status: usedTokens == null ? 'unavailable' : 'stale',
          };
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    assistantReady,
    hasApiConfiguration,
    scope,
    stream.apiKey,
    stream.apiUrl,
    stream.client,
    stream.isLoading,
  ]);

  const effectiveMaxContextSize =
    realtimeUsage?.effectiveModel?.contextWindow ?? maxContextSize;
  if (
    typeof effectiveMaxContextSize !== 'number' ||
    !Number.isFinite(effectiveMaxContextSize) ||
    effectiveMaxContextSize <= 0
  ) {
    return null;
  }

  const max = Math.floor(effectiveMaxContextSize);
  const usedContextSize =
    measurement?.scope === scope ? measurement.usedTokens : null;
  const usageStatus =
    measurement?.scope === scope ? measurement.status : 'unavailable';
  const hasMeasurement = usedContextSize != null;
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
  const statusLabel =
    usageStatus === 'stale'
      ? t('chat.contextUsage.stale')
      : !hasMeasurement
        ? t('chat.contextUsage.unavailable')
        : null;
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
          aria-label={`${usageLabelWithSuffix} ${hasMeasurement ? `${usageFullLabel}. ${usageTokensLabel}` : ''}${statusLabel ? ` ${statusLabel}` : ''}`}
        >
          {hasMeasurement ? (
            <ProgressCircle
              value={percent}
              className={cn('size-5', progressClassName)}
            />
          ) : (
            <CircleHelp
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="space-y-0.5 px-3 py-2 text-center"
      >
        <div className="text-primary-foreground/70">{usageLabelWithSuffix}</div>
        {hasMeasurement && (
          <>
            <div className="font-medium text-primary-foreground/80">
              {usageFullLabel}
            </div>
            <div className="text-sm font-semibold">{usageTokensLabel}</div>
          </>
        )}
        {!hasMeasurement && statusLabel && (
          <div className="text-sm">{statusLabel}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
