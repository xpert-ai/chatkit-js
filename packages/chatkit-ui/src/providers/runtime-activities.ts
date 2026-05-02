import * as React from 'react';
import type { Client } from '@xpert-ai/xpert-sdk';

import {
  RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID,
  createDefaultRuntimeActivitiesState,
  filterActiveSandboxServices,
  getSandboxServicesPollingIntervalMs,
  type RuntimeActivitiesState,
  type RuntimeActivityProviderId,
  type RuntimeActivityTrigger,
} from '../lib/runtime-activity';

export type UseRuntimeActivitiesOptions<TState> = {
  client: Client<TState>;
  threadId: string | null;
  enabled?: boolean;
  getOrganizationId: () => string | undefined;
  setError: React.Dispatch<React.SetStateAction<unknown>>;
};

export type UseRuntimeActivitiesResult = {
  runtimeActivities: RuntimeActivitiesState;
  clearRuntimeActivities: () => void;
  refreshSandboxServices: (options?: {
    targetThreadId?: string | null;
    force?: boolean;
  }) => Promise<void> | undefined;
  handleRuntimeActivityTrigger: (trigger: RuntimeActivityTrigger) => void;
  stopRuntimeActivityItem: (
    providerId: RuntimeActivityProviderId,
    itemId: string,
  ) => Promise<void>;
};

function normalizeThreadIdentifier(threadId?: string | null): string | null {
  const normalized = typeof threadId === 'string' ? threadId.trim() : '';
  return normalized ? normalized : null;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isRuntimeActivityDebugEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const globalWindow = window as Window & {
    __CHATKIT_RUNTIME_ACTIVITIES_DEBUG__?: boolean;
  };
  if (globalWindow.__CHATKIT_RUNTIME_ACTIVITIES_DEBUG__ === true) {
    return true;
  }

  try {
    return (
      window.localStorage.getItem('chatkit:runtime-activities:debug') === 'true'
    );
  } catch {
    return false;
  }
}

export function logRuntimeActivity(
  message: string,
  details?: Record<string, unknown>,
) {
  if (!isRuntimeActivityDebugEnabled()) {
    return;
  }

  console.debug('[chatkit-ui][runtime-activities]', message, details ?? {});
}

function getSandboxServiceStatusCounts(
  services: { status?: string | null }[],
): Record<string, number> {
  return services.reduce<Record<string, number>>((counts, service) => {
    const status = service.status ?? 'unknown';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function getDocumentVisibilityState(): DocumentVisibilityState {
  if (typeof document === 'undefined') {
    return 'visible';
  }

  return document.visibilityState;
}

function useDocumentVisibilityState(): DocumentVisibilityState {
  const [visibilityState, setVisibilityState] =
    React.useState<DocumentVisibilityState>(() => getDocumentVisibilityState());

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setVisibilityState(document.visibilityState);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return visibilityState;
}

export function useRuntimeActivities<TState>({
  client,
  threadId,
  enabled = true,
  getOrganizationId,
  setError,
}: UseRuntimeActivitiesOptions<TState>): UseRuntimeActivitiesResult {
  const [runtimeActivities, setRuntimeActivities] =
    React.useState<RuntimeActivitiesState>(() =>
      createDefaultRuntimeActivitiesState(),
    );
  const runtimeActivityVersionRef = React.useRef(0);
  const sandboxServicesRefreshPromiseRef = React.useRef<Promise<void> | null>(
    null,
  );
  const sandboxServicesAbortRef = React.useRef<AbortController | null>(null);
  const hydratedSandboxServicesThreadRef = React.useRef<string | null>(null);
  const hydratedSandboxServicesClientRef =
    React.useRef<Client<TState> | null>(null);
  const pageVisibilityState = useDocumentVisibilityState();
  const previousPageVisibilityStateRef =
    React.useRef<DocumentVisibilityState>(pageVisibilityState);

  const abortSandboxServicesRefresh = React.useCallback(() => {
    if (sandboxServicesAbortRef.current) {
      logRuntimeActivity('abort sandbox services refresh');
    }
    sandboxServicesAbortRef.current?.abort();
    sandboxServicesAbortRef.current = null;
    sandboxServicesRefreshPromiseRef.current = null;
  }, []);

  const clearRuntimeActivities = React.useCallback(() => {
    logRuntimeActivity('clear runtime activities');
    runtimeActivityVersionRef.current += 1;
    abortSandboxServicesRefresh();
    setRuntimeActivities(createDefaultRuntimeActivitiesState());
  }, [abortSandboxServicesRefresh]);

  const refreshSandboxServices = React.useCallback(
    async (options?: { targetThreadId?: string | null; force?: boolean }) => {
      const targetThreadId = normalizeThreadIdentifier(
        options?.targetThreadId ?? threadId ?? null,
      );
      if (!enabled || !targetThreadId) {
        logRuntimeActivity('skip sandbox services refresh', {
          enabled,
          targetThreadId,
          reason: !enabled ? 'disabled' : 'missing-thread',
        });
        return;
      }

      if (options?.force) {
        logRuntimeActivity('force sandbox services refresh', {
          targetThreadId,
        });
        abortSandboxServicesRefresh();
      } else if (sandboxServicesRefreshPromiseRef.current) {
        logRuntimeActivity('dedupe sandbox services refresh', {
          targetThreadId,
        });
        return sandboxServicesRefreshPromiseRef.current;
      }

      const abortController = new AbortController();
      const requestVersion = runtimeActivityVersionRef.current;
      sandboxServicesAbortRef.current = abortController;
      setRuntimeActivities((prev) => ({
        ...prev,
        sandboxServices: {
          ...prev.sandboxServices,
          isRefreshing: true,
          error: null,
        },
      }));

      const refreshPromise = (async () => {
        try {
          logRuntimeActivity('list sandbox services start', {
            targetThreadId,
            organizationId: getOrganizationId(),
          });
          const services = await client.sandbox.listThreadServices(
            targetThreadId,
            {
              organizationId: getOrganizationId(),
              signal: abortController.signal,
            },
          );
          if (
            abortController.signal.aborted ||
            requestVersion !== runtimeActivityVersionRef.current
          ) {
            logRuntimeActivity('ignore sandbox services refresh result', {
              targetThreadId,
              aborted: abortController.signal.aborted,
              stale: requestVersion !== runtimeActivityVersionRef.current,
            });
            return;
          }

          const activeServices = filterActiveSandboxServices(services);
          logRuntimeActivity('list sandbox services success', {
            targetThreadId,
            totalCount: services.length,
            activeCount: activeServices.length,
            statusCounts: getSandboxServiceStatusCounts(services),
          });
          setRuntimeActivities((prev) => ({
            ...prev,
            sandboxServices: {
              ...prev.sandboxServices,
              services: activeServices,
              isRefreshing: false,
              refreshedAt: Date.now(),
              error: null,
            },
          }));
        } catch (refreshError) {
          if (
            isAbortError(refreshError) ||
            abortController.signal.aborted ||
            requestVersion !== runtimeActivityVersionRef.current
          ) {
            logRuntimeActivity('ignore sandbox services refresh error', {
              targetThreadId,
              aborted: abortController.signal.aborted,
              stale: requestVersion !== runtimeActivityVersionRef.current,
            });
            return;
          }

          console.warn(
            '[chatkit-ui][runtime-activities] list sandbox services failed',
            refreshError,
          );
          setRuntimeActivities((prev) => ({
            ...prev,
            sandboxServices: {
              ...prev.sandboxServices,
              isRefreshing: false,
              error: refreshError,
            },
          }));
        } finally {
          if (sandboxServicesAbortRef.current === abortController) {
            sandboxServicesAbortRef.current = null;
            sandboxServicesRefreshPromiseRef.current = null;
          }
          if (
            !abortController.signal.aborted &&
            requestVersion === runtimeActivityVersionRef.current
          ) {
            setRuntimeActivities((prev) => ({
              ...prev,
              sandboxServices: {
                ...prev.sandboxServices,
                isRefreshing: false,
              },
            }));
          }
        }
      })();

      sandboxServicesRefreshPromiseRef.current = refreshPromise;
      return refreshPromise;
    },
    [abortSandboxServicesRefresh, client, enabled, getOrganizationId, threadId],
  );
  const refreshSandboxServicesRef = React.useRef(refreshSandboxServices);

  React.useEffect(() => {
    refreshSandboxServicesRef.current = refreshSandboxServices;
  }, [refreshSandboxServices]);

  const handleRuntimeActivityTrigger = React.useCallback(
    (trigger: RuntimeActivityTrigger) => {
      if (trigger.providerId === RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID) {
        logRuntimeActivity('sandbox services tool trigger', {
          tool: trigger.tool,
          componentId: trigger.componentId,
          threadId: trigger.threadId,
        });
        void refreshSandboxServices({
          targetThreadId: trigger.threadId,
          force: true,
        });
      }
    },
    [refreshSandboxServices],
  );

  const stopRuntimeActivityItem = React.useCallback(
    async (providerId: RuntimeActivityProviderId, itemId: string) => {
      if (
        providerId !== RUNTIME_ACTIVITY_SANDBOX_SERVICES_PROVIDER_ID ||
        !itemId
      ) {
        return;
      }

      const targetThreadId = normalizeThreadIdentifier(threadId);
      if (!enabled || !targetThreadId) {
        logRuntimeActivity('skip stopping sandbox service', {
          enabled,
          targetThreadId,
          itemId,
          reason: !enabled ? 'disabled' : 'missing-thread',
        });
        return;
      }

      setRuntimeActivities((prev) => ({
        ...prev,
        sandboxServices: {
          ...prev.sandboxServices,
          isRefreshing: true,
          error: null,
        },
      }));

      try {
        logRuntimeActivity('stop sandbox service start', {
          targetThreadId,
          itemId,
        });
        await client.sandbox.stopThreadService(targetThreadId, itemId, {
          organizationId: getOrganizationId(),
        });
        await refreshSandboxServices({
          targetThreadId,
          force: true,
        });
      } catch (stopError) {
        if (isAbortError(stopError)) {
          return;
        }
        setError(stopError);
        setRuntimeActivities((prev) => ({
          ...prev,
          sandboxServices: {
            ...prev.sandboxServices,
            isRefreshing: false,
            error: stopError,
          },
        }));
      }
    },
    [
      client,
      enabled,
      getOrganizationId,
      refreshSandboxServices,
      setError,
      threadId,
    ],
  );

  React.useEffect(() => {
    const activeThreadId = normalizeThreadIdentifier(threadId);
    if (!enabled || !activeThreadId) {
      logRuntimeActivity('skip sandbox services hydration', {
        enabled,
        threadId,
        activeThreadId,
        reason: !enabled ? 'disabled' : 'missing-thread',
      });
      const shouldClear =
        hydratedSandboxServicesThreadRef.current !== null ||
        hydratedSandboxServicesClientRef.current !== null ||
        sandboxServicesAbortRef.current !== null ||
        sandboxServicesRefreshPromiseRef.current !== null;
      hydratedSandboxServicesThreadRef.current = null;
      hydratedSandboxServicesClientRef.current = null;
      if (shouldClear) {
        clearRuntimeActivities();
      }
      return;
    }

    if (
      hydratedSandboxServicesThreadRef.current === activeThreadId &&
      hydratedSandboxServicesClientRef.current === client
    ) {
      logRuntimeActivity('skip sandbox services hydration', {
        activeThreadId,
        reason: 'already-hydrated',
      });
      return;
    }

    logRuntimeActivity('hydrate sandbox services', {
      activeThreadId,
    });
    hydratedSandboxServicesThreadRef.current = activeThreadId;
    hydratedSandboxServicesClientRef.current = client;
    clearRuntimeActivities();
    void refreshSandboxServicesRef.current({
      targetThreadId: activeThreadId,
      force: true,
    });
  }, [clearRuntimeActivities, client, enabled, threadId]);

  React.useEffect(() => {
    const previousPageVisibilityState = previousPageVisibilityStateRef.current;
    previousPageVisibilityStateRef.current = pageVisibilityState;

    const activeThreadId = normalizeThreadIdentifier(threadId);
    if (
      pageVisibilityState !== 'visible' ||
      previousPageVisibilityState === 'visible' ||
      !enabled ||
      !activeThreadId ||
      runtimeActivities.sandboxServices.services.length === 0
    ) {
      return;
    }

    logRuntimeActivity('refresh sandbox services after page visible', {
      activeThreadId,
      activeCount: runtimeActivities.sandboxServices.services.length,
    });
    void refreshSandboxServices({ targetThreadId: activeThreadId });
  }, [
    enabled,
    pageVisibilityState,
    refreshSandboxServices,
    runtimeActivities.sandboxServices.services.length,
    threadId,
  ]);

  React.useEffect(() => {
    const activeServices = runtimeActivities.sandboxServices.services;
    const pollingIntervalMs =
      getSandboxServicesPollingIntervalMs(activeServices);
    const activeThreadId = normalizeThreadIdentifier(threadId);
    if (
      !enabled ||
      !activeThreadId ||
      pageVisibilityState !== 'visible' ||
      pollingIntervalMs === null
    ) {
      logRuntimeActivity('skip sandbox services polling', {
        enabled,
        activeThreadId,
        activeCount: activeServices.length,
        pageVisibilityState,
        reason: !enabled
          ? 'disabled'
          : !activeThreadId
            ? 'missing-thread'
            : pageVisibilityState !== 'visible'
              ? 'page-hidden'
              : 'no-active-services',
      });
      return;
    }

    logRuntimeActivity('schedule sandbox services polling', {
      activeThreadId,
      activeCount: activeServices.length,
      intervalMs: pollingIntervalMs,
    });
    const timer = window.setTimeout(() => {
      void refreshSandboxServices({ targetThreadId: activeThreadId });
    }, pollingIntervalMs);

    return () => {
      logRuntimeActivity('cancel sandbox services polling', {
        activeThreadId,
      });
      window.clearTimeout(timer);
    };
  }, [
    enabled,
    pageVisibilityState,
    refreshSandboxServices,
    runtimeActivities.sandboxServices.error,
    runtimeActivities.sandboxServices.refreshedAt,
    runtimeActivities.sandboxServices.services,
    threadId,
  ]);

  React.useEffect(() => abortSandboxServicesRefresh, [
    abortSandboxServicesRefresh,
  ]);

  return {
    runtimeActivities,
    clearRuntimeActivities,
    refreshSandboxServices,
    handleRuntimeActivityTrigger,
    stopRuntimeActivityItem,
  };
}
