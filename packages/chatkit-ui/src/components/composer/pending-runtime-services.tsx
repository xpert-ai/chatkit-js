import * as React from 'react';
import { Loader2, Server, Square } from 'lucide-react';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
  type SandboxManagedService,
  type SandboxServicesActivityState,
} from '../../lib/runtime-activity';
import { PendingActivityPanel } from './pending-activity-panel';

export type PendingRuntimeServicesProps = {
  state: SandboxServicesActivityState;
  onStopService: (serviceId: string) => Promise<void> | void;
  attachToComposer?: boolean;
  className?: string;
};

function getServicePortLabel(service: SandboxManagedService): string | null {
  const port = service.actualPort ?? service.requestedPort;
  return typeof port === 'number' ? `:${port}` : null;
}

function getServiceMetaLabel(service: SandboxManagedService): string {
  const labels = [
    service.status,
    service.transportMode === 'http' ? 'http' : null,
    getServicePortLabel(service),
  ].filter((item): item is string => Boolean(item));

  return labels.join(' / ');
}

export function PendingRuntimeServices({
  state,
  onStopService,
  attachToComposer = true,
  className,
}: PendingRuntimeServicesProps) {
  const { t } = useChatkitTranslation();
  const listId = React.useId();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [stoppingServiceIds, setStoppingServiceIds] = React.useState<string[]>(
    [],
  );
  const serviceKey = state.services
    .map((service) => service.id ?? service.name)
    .join('|');

  React.useEffect(() => {
    setIsCollapsed(false);
  }, [serviceKey]);

  if (state.services.length === 0) {
    return null;
  }

  const stopService = async (serviceId: string) => {
    if (!serviceId || stoppingServiceIds.includes(serviceId)) {
      return;
    }

    setStoppingServiceIds((prev) => [...prev, serviceId]);
    try {
      await onStopService(serviceId);
    } finally {
      setStoppingServiceIds((prev) => prev.filter((id) => id !== serviceId));
    }
  };

  return (
    <PendingActivityPanel
      icon={
        <Server className="shrink-0 text-muted-foreground" aria-hidden="true" />
      }
      summary={t('chat.runtimeServices.summary', {
        count: state.services.length,
      })}
      accessory={
        state.isRefreshing ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : null
      }
      listId={listId}
      isCollapsed={isCollapsed}
      onToggle={() => setIsCollapsed((prev) => !prev)}
      attachToComposer={attachToComposer}
      className={className}
    >
      <ul id={listId} data-slot="pending-activity-list">
        {state.services.map((service) => {
          const serviceId = service.id ?? '';
          const isStopping = stoppingServiceIds.includes(serviceId);

          return (
            <li
              key={service.id ?? `${service.name}:${service.command}`}
              className="flex min-w-0 items-center gap-[calc(0.5rem*var(--chat-density-scale,1))]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-[calc(0.5rem*var(--chat-density-scale,1))]">
                  <span
                    title={service.name}
                    className="min-w-0 truncate text-sm font-medium leading-5 text-foreground"
                  >
                    {service.name}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {getServiceMetaLabel(service)}
                  </span>
                </div>
                <div
                  title={service.command}
                  className="min-w-0 truncate font-mono text-xs leading-5 text-muted-foreground"
                >
                  {service.command}
                </div>
              </div>
              <button
                type="button"
                data-slot="pending-activity-action"
                className="inline-flex shrink-0 items-center justify-center rounded-chat-item text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                aria-label={t('chat.runtimeServices.stop')}
                title={t('chat.runtimeServices.stop')}
                disabled={!serviceId || isStopping}
                onClick={() => {
                  void stopService(serviceId);
                }}
              >
                {isStopping ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Square className="fill-current" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </PendingActivityPanel>
  );
}

export const SANDBOX_SERVICES_RUNTIME_PANEL_ID =
  RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID;
