import * as React from 'react';
import {
  ChevronDown,
  Loader2,
  Server,
  Square,
} from 'lucide-react';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
  type SandboxManagedService,
  type SandboxServicesActivityState,
} from '../../lib/runtime-activity';
import { cn, getRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';

export type PendingRuntimeServicesProps = {
  state: SandboxServicesActivityState;
  onStopService: (serviceId: string) => Promise<void> | void;
  attachToComposer?: boolean;
  className?: string;
};

function useRoundedClasses() {
  const { theme } = useTheme();

  return {
    top: theme.radius
      ? {
          pill: 'rounded-t-full',
          round: 'rounded-t-xl',
          soft: 'rounded-t-lg',
          sharp: 'rounded-t-none',
        }[theme.radius]
      : 'rounded-t-lg',
    panel: getRoundedClass(theme.radius, 'rounded-lg'),
  };
}

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
  const rounded = useRoundedClasses();
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
    <div
      aria-live="polite"
      className={cn(
        'mx-2 border border-border bg-background/95 px-3 py-3 shadow-sm',
        attachToComposer ? 'border-b-0' : null,
        attachToComposer ? rounded.top : rounded.panel,
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={!isCollapsed}
        aria-controls={listId}
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {t('chat.runtimeServices.summary', {
              count: state.services.length,
            })}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {state.isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : null}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isCollapsed ? null : 'rotate-180',
            )}
          />
        </div>
      </button>

      {!isCollapsed && (
        <ul id={listId} className="mt-3 space-y-2.5">
          {state.services.map((service) => {
            const serviceId = service.id ?? '';
            const isStopping = stoppingServiceIds.includes(serviceId);

            return (
              <li
                key={service.id ?? `${service.name}:${service.command}`}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_28px] items-center gap-2"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      title={service.name}
                      className="min-w-0 truncate text-sm font-medium leading-5 text-foreground"
                    >
                      {service.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
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
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  aria-label={t('chat.runtimeServices.stop')}
                  title={t('chat.runtimeServices.stop')}
                  disabled={!serviceId || isStopping}
                  onClick={() => {
                    void stopService(serviceId);
                  }}
                >
                  {isStopping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const SANDBOX_SERVICES_RUNTIME_PANEL_ID =
  RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID;
