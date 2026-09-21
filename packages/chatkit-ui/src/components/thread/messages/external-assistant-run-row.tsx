import * as React from 'react';
import { Bot, ChevronRight, Clock3 } from 'lucide-react';
import type { AgentRunInfo } from '../../../lib/agent-runs';
import {
  getAgentRunDuration,
  getAgentRunTitle,
  isRunningRunStatus,
} from '../../../lib/agent-run-render-tree';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { formatStepDuration, getAgentRunStatusConfig } from './agent-run-group';
import { ChatkitAvatar } from '../../ui/chatkit-avatar';

export function ExternalAssistantAvatar({ info }: { info: AgentRunInfo }) {
  const { t } = useChatkitTranslation();
  return info.avatar ? (
    <ChatkitAvatar
      avatar={info.avatar}
      label={getAgentRunTitle(info, t('message.agentRun.defaultTitle')) ?? ''}
      className="size-5 shrink-0"
    />
  ) : (
    <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
  );
}

export function AgentRunStatus({ info }: { info: AgentRunInfo }) {
  const { t } = useChatkitTranslation();
  const [now, setNow] = React.useState(Date.now);
  const running = isRunningRunStatus(info.status);
  React.useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const config = getAgentRunStatusConfig(info.status);
  const StatusIcon = config.icon;
  const duration = getAgentRunDuration(info, now);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
    >
      <StatusIcon
        className={cn('h-3.5 w-3.5', config.spin && 'animate-spin')}
        aria-hidden="true"
      />
      {t(`message.agentRun.status.${config.labelKey}`, {
        defaultValue: info.status ?? config.labelKey,
      })}
      {duration !== null && (
        <>
          <Clock3 className="ml-1 h-3 w-3" aria-hidden="true" />
          <span className="tabular-nums">{formatStepDuration(duration)}</span>
        </>
      )}
    </span>
  );
}

export function ExternalAssistantRunRow({
  info,
  onOpen,
}: {
  info: AgentRunInfo;
  onOpen: (id: string) => void;
}) {
  const { t } = useChatkitTranslation();
  const title = getAgentRunTitle(info, t('message.agentRun.defaultTitle'));
  return (
    <button
      type="button"
      onClick={() => onOpen(info.id)}
      aria-label={t('workbench.externalAssistants.openRun', { name: title })}
      className="group flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ExternalAssistantAvatar info={info} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {title}
      </span>
      <AgentRunStatus info={info} />
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </button>
  );
}
