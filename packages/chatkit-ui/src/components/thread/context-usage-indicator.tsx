import * as React from 'react';

import { cn } from '../../lib/utils';
import { useStreamContext } from '../../providers/Stream';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { ProgressCircle } from '../ui/progress-circle';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type ContextUsageIndicatorProps = {
  label?: string;
  className?: string;
};

const CONTEXT_USAGE_POLL_INTERVAL_MS = 3000;

const kNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function normalizeContextSize(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

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
    normalizeContextSize(assistant.metadata?.context_size) ??
    normalizeContextSize(assistant.config?.configurable?.context_size)
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
  const [maxContextSize, setMaxContextSize] = React.useState<number | null>(null);
  const [usedContextSize, setUsedContextSize] = React.useState<number | null>(null);
  const [assistantAgentKey, setAssistantAgentKey] = React.useState<string | null>(null);
  const inFlightRef = React.useRef<Promise<void> | null>(null);
  const pendingRef = React.useRef(false);
  const isMountedRef = React.useRef(true);
  const latestContextUsageRequestRef = React.useRef<{
    client: typeof stream.client;
    threadId: typeof stream.threadId;
    assistantAgentKey: string | null;
  }>({
    client: stream.client,
    threadId: stream.threadId,
    assistantAgentKey,
  });
  const loadContextUsageRef = React.useRef<() => Promise<void>>(async () => {});

  latestContextUsageRequestRef.current = {
    client: stream.client,
    threadId: stream.threadId,
    assistantAgentKey,
  };

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!stream.client || !stream.assistantId) {
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
  }, [stream.client, stream.assistantId]);

  loadContextUsageRef.current = async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return inFlightRef.current;
    }

    inFlightRef.current = (async () => {
      do {
        pendingRef.current = false;

        const {
          client,
          threadId,
          assistantAgentKey: currentAssistantAgentKey,
        } = latestContextUsageRequestRef.current;

        if (!client) {
          if (isMountedRef.current) {
            setUsedContextSize(null);
          }
          return;
        }

        if (!threadId) {
          if (isMountedRef.current) {
            setUsedContextSize(0);
          }
          return;
        }

        try {
          const result = await client.threads.getContextUsage(
            threadId,
            currentAssistantAgentKey ? { agentKey: currentAssistantAgentKey } : undefined,
          );
          const nextUsedContextSize =
            normalizeContextSize(result?.usage?.context_tokens) ?? 0;

          if (!isMountedRef.current) {
            return;
          }

          if (
            latestContextUsageRequestRef.current.client !== client ||
            latestContextUsageRequestRef.current.threadId !== threadId ||
            latestContextUsageRequestRef.current.assistantAgentKey !==
              currentAssistantAgentKey
          ) {
            pendingRef.current = true;
            continue;
          }

          setUsedContextSize(nextUsedContextSize);
        } catch (err) {
          if (!isMountedRef.current) {
            return;
          }

          if (
            latestContextUsageRequestRef.current.client !== client ||
            latestContextUsageRequestRef.current.threadId !== threadId ||
            latestContextUsageRequestRef.current.assistantAgentKey !==
              currentAssistantAgentKey
          ) {
            pendingRef.current = true;
            continue;
          }

          console.warn('[Chat] Failed to load thread context usage:', err);
        }
      } while (pendingRef.current);
    })().finally(() => {
      inFlightRef.current = null;
    });

    return inFlightRef.current;
  };

  React.useEffect(() => {
    void loadContextUsageRef.current();

    if (!stream.threadId || !stream.isLoading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadContextUsageRef.current();
    }, CONTEXT_USAGE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    assistantAgentKey,
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
  const usageLabelWithSuffix = usageLabel.endsWith(':') ? usageLabel : `${usageLabel}:`;
  const progressClassName =
    percent >= 90 ? 'text-destructive' : percent >= 75 ? 'text-amber-500' : 'text-primary dark:text-zinc-300';

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
          <ProgressCircle value={percent} className={cn('size-3.5', progressClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="space-y-0.5 px-3 py-2 text-center">
        <div className="text-primary-foreground/70">{usageLabelWithSuffix}</div>
        <div className="font-medium text-primary-foreground/80">{usageFullLabel}</div>
        <div className="text-sm font-semibold">{usageTokensLabel}</div>
      </TooltipContent>
    </Tooltip>
  );
}
