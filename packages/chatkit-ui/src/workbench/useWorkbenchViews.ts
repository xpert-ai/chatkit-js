import { useEffect, useState } from 'react';
import type {
  Client,
  XpertExtensionViewManifest,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';

type ViewState = {
  scope: string | null;
  retentionKey: string | null;
  views: XpertExtensionViewManifest[];
  loading: boolean;
  loaded: boolean;
  settledRevision: number | null;
  error: string | null;
};
const emptyState: ViewState = {
  scope: null,
  retentionKey: null,
  views: [],
  loading: false,
  loaded: false,
  settledRevision: null,
  error: null,
};

/** Keep Assistant views mounted while revalidating their new runtime context. */
export function useWorkbenchViews({
  client,
  hostId,
  scopeKey,
  retentionKey = scopeKey,
  runtimeScope,
  enabled,
  ready,
  locale,
  revision,
}: {
  client: Pick<Client['viewHosts'], 'listSlotViews'>;
  hostId: string;
  scopeKey: string;
  retentionKey?: string;
  runtimeScope: XpertViewRuntimeScopeInput;
  enabled: boolean;
  ready: boolean;
  locale: string;
  revision: number;
}) {
  const [state, setState] = useState(emptyState);
  const { t } = useChatkitTranslation();
  const failureMessage = t('workbench.loadFailed');
  useEffect(() => {
    if (!enabled) {
      setState(emptyState);
      return;
    }
    if (!ready) return;
    const controller = new AbortController();
    setState((previous) => ({
      ...(previous.retentionKey === retentionKey ? previous : emptyState),
      retentionKey,
      loading: true,
      error: null,
    }));
    void client
      .listSlotViews('agent', hostId, 'agent.workbench.fixed', {
        signal: controller.signal,
        runtimeScope,
      })
      .then((manifests) => {
        if (controller.signal.aborted) return;
        const views = manifests
          .filter(
            (view) =>
              view.visible !== false &&
              view.workbench?.fixed !== false &&
              view.view.type === 'remote_component' &&
              view.view.component.isolation === 'iframe',
          )
          .sort(
            (left, right) =>
              (left.workbench?.menu?.order ?? left.order ?? 0) -
                (right.workbench?.menu?.order ?? right.order ?? 0) ||
              left.key.localeCompare(right.key),
          );
        setState({
          scope: scopeKey,
          retentionKey,
          views,
          loading: false,
          loaded: true,
          settledRevision: revision,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : failureMessage;
        const unavailable =
          error instanceof Error &&
          'status' in error &&
          (error.status === 401 ||
            error.status === 403 ||
            error.status === 404);
        setState((previous) => ({
          ...(unavailable
            ? { ...emptyState, scope: scopeKey, retentionKey }
            : previous),
          loading: false,
          settledRevision: revision,
          error: message,
        }));
      });
    return () => controller.abort();
  }, [
    client,
    hostId,
    scopeKey,
    retentionKey,
    runtimeScope,
    enabled,
    ready,
    locale,
    revision,
    failureMessage,
  ]);

  const current =
    enabled && state.retentionKey === retentionKey ? state : emptyState;
  const loading =
    enabled && (!ready || state.scope !== scopeKey || current.loading);
  return {
    views: current.views,
    viewsScope: current.loaded ? current.scope : null,
    loading,
    // Keep authorization pending without making retained discovery content jump.
    // Initial discovery and an explicit reload still provide loading feedback.
    showLoading:
      loading &&
      !current.error &&
      (!current.loaded || current.settledRevision !== revision),
    error: current.error,
  };
}
