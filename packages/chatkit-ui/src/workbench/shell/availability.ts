import type { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function workbenchDisabledReason({ external, assistantId, authenticated, loading, count, error, sideChatEnabled, t }: {
  external: boolean; assistantId: string; authenticated: boolean; loading: boolean;
  count: number; error: string | null; sideChatEnabled: boolean;
  t: ReturnType<typeof useChatkitTranslation>['t'];
}) {
  if (external) return undefined;
  if (!assistantId.trim()) return t('workbench.missingAssistant');
  if (!authenticated || (loading && count === 0)) return t('workbench.loading');
  if (error) return t('workbench.loadFailed');
  if (count === 0 && !sideChatEnabled) return t('workbench.empty');
  return undefined;
}

export function workbenchAvailable(input: {
  groupReady: boolean; authenticated: boolean; external: boolean; enabled: boolean;
  assistantId: string; sideChat: boolean; remoteViewsEnabled: boolean;
  scopeReady: boolean; loading: boolean; count: number;
}) {
  return (input.groupReady && input.authenticated) || input.external ||
    (input.enabled && input.authenticated && Boolean(input.assistantId.trim()) &&
      (input.sideChat || (input.remoteViewsEnabled && input.scopeReady && (!input.loading || input.count > 0))));
}
