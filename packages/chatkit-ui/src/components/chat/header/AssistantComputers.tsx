import * as React from 'react';
import type { ChatKitAssistantComputers } from '@xpert-ai/chatkit-types';
import { ChevronRight, Laptop, Monitor } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { useStreamContext } from '../../../providers/Stream';
import { useWorkbench } from '../../../workbench/context';

// These are the states returned by Computer View's read-only data endpoint.
function computerState(item: unknown) {
  if (item && typeof item === 'object' && 'state' in item) {
    switch (item.state) {
      case 'ready':
        return 'running';
      case 'starting':
        return 'starting';
      case 'stopped':
        return 'stopped';
      case 'needs_environment':
        return 'notStarted';
    }
  }
  return 'error';
}

export function AssistantComputers({
  computers,
  onOpenLocal,
  onNavigate,
}: {
  computers?: ChatKitAssistantComputers;
  onOpenLocal: () => void;
  onNavigate: () => void;
}) {
  const { t } = useChatkitTranslation();
  const stream = useStreamContext();
  const workbench = useWorkbench();
  const viewKey = computers?.cloud?.viewKey;
  const hasView =
    !!viewKey &&
    !!workbench.viewMenu?.views.some((view) => view.key === viewKey);
  const scope = JSON.stringify([
    stream.assistantId,
    stream.projectId,
    stream.conversationId,
    viewKey,
  ]);
  const [remote, setRemote] = React.useState<{
    scope: string;
    state: string;
  } | null>(null);
  React.useEffect(() => {
    if (
      !hasView ||
      !viewKey ||
      !workbench.available ||
      workbench.loading ||
      stream.runtimeScopeReady === false
    )
      return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const result = await stream.client.viewHosts.getData(
          'agent',
          stream.assistantId,
          viewKey,
          {},
          {
            signal: controller.signal,
            runtimeScope: {
              projectId: stream.projectId ?? null,
              conversationId: stream.conversationId ?? null,
            },
          },
        );
        if (!controller.signal.aborted)
          setRemote({ scope, state: computerState(result.item) });
      } catch {
        if (!controller.signal.aborted) setRemote({ scope, state: 'error' });
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    hasView,
    viewKey,
    workbench.available,
    workbench.loading,
    stream.runtimeScopeReady,
    stream.client,
    stream.assistantId,
    stream.projectId,
    stream.conversationId,
    scope,
  ]);
  if (!computers?.cloud && !computers?.local) return null;
  const cloudState =
    workbench.loading || stream.runtimeScopeReady === false
      ? 'loading'
      : !hasView || !workbench.available
        ? 'unavailable'
        : remote?.scope === scope
          ? remote.state
          : 'loading';
  const canOpenCloud =
    hasView &&
    workbench.available &&
    !workbench.loading &&
    stream.runtimeScopeReady !== false;
  return (
    <section
      className="chatkit-presence-computers border-b border-border/60"
      aria-label={t('assistantComputers.title')}
    >
      <h3 className="chatkit-presence-computers-heading text-xs font-medium text-muted-foreground">
        {t('assistantComputers.title')}
      </h3>
      {computers.cloud && (
        <ComputerRow
          icon="cloud"
          name={t('assistantComputers.cloud')}
          status={t(`assistantComputers.${cloudState}`)}
          active={cloudState === 'running'}
          disabled={!canOpenCloud}
          onClick={() => {
            if (!canOpenCloud || !viewKey) return;
            workbench.viewMenu?.onSelect(viewKey);
            onNavigate();
          }}
        />
      )}
      {computers.local && (
        <ComputerRow
          icon="local"
          name={computers.local.name || t('assistantComputers.local')}
          status={`${t('assistantComputers.shell')} · ${t(`assistantComputers.${computers.local.status}`)}`}
          active={computers.local.status === 'connected'}
          disabled={computers.local.status === 'unavailable'}
          onClick={() => {
            onNavigate();
            onOpenLocal();
          }}
        />
      )}
    </section>
  );
}

function ComputerRow({
  icon,
  name,
  status,
  active,
  disabled,
  onClick,
}: {
  icon: 'cloud' | 'local';
  name: string;
  status: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = icon === 'cloud' ? Monitor : Laptop;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="chatkit-presence-computer-row flex w-full items-center rounded-xl text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
    >
      <span className="relative shrink-0 text-muted-foreground">
        <Icon className="size-5" />
        {active && (
          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-popover bg-primary" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block text-xs text-muted-foreground">{status}</span>
      </span>
      {!disabled && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
