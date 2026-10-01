import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { useStreamManager } from '../../../hooks/useStream';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { getMissingApiConfigurationKind } from '../../../lib/api-config';
import { useStreamContext } from '../../../providers/Stream';
import { useTheme } from '../../../providers/Theme';
import { useWorkbench } from '../../../workbench/context';

const defaultApiUrl = import.meta.env.VITE_XPERTAI_API_URL as
  | string
  | undefined;

type ChatEnvironmentOptions = {
  options: ChatKitOptions | null | undefined;
  configuredProjectId: string | undefined;
  clientSecret: string;
  isClientSecretInitializing: boolean;
};

export function useChatEnvironment({
  options,
  configuredProjectId,
  clientSecret,
  isClientSecretInitializing,
}: ChatEnvironmentOptions) {
  const { t, i18n } = useChatkitTranslation();
  const composer = options?.composer;
  const startScreen = options?.startScreen;
  const history = options?.history;
  const disclaimer = options?.disclaimer;
  const apiUrl = options?.api?.apiUrl || defaultApiUrl;
  const messageNavigationEnabled =
    options?.messageNavigation?.enabled !== false;

  const { setStream } = useStreamManager();
  const stream = useStreamContext();
  const activeProjectId = stream.projectScopeResolved
    ? stream.projectId
    : (stream.projectId ?? configuredProjectId);

  const workbench = useWorkbench();
  const xpertPlatformClient = stream.client;
  const { theme } = useTheme();
  const effectiveClientSecret = stream.apiKey?.trim()
    ? stream.apiKey
    : clientSecret;

  const missingConfigKind = getMissingApiConfigurationKind({
    apiUrl,
    clientSecret: effectiveClientSecret,
  });

  const missingConfig = Boolean(missingConfigKind);
  const missingConfigShortMessage = React.useMemo(() => {
    switch (missingConfigKind) {
      case 'apiUrl':
        return t('chat.missingApiUrlShort');
      case 'clientSecret':
        return t('chat.missingClientSecretShort');
      case 'apiUrlAndClientSecret':
        return t('chat.missingApiUrlAndClientSecretShort');
      default:
        return t('chat.missingConfigShort');
    }
  }, [missingConfigKind, t]);

  const missingConfigDetailMessage = React.useMemo(() => {
    switch (missingConfigKind) {
      case 'apiUrl':
        return t('chat.missingApiUrlDetail');
      case 'clientSecret':
        return t('chat.missingClientSecretDetail');
      case 'apiUrlAndClientSecret':
        return t('chat.missingApiUrlAndClientSecretDetail');
      default:
        return t('chat.missingConfigDetail');
    }
  }, [missingConfigKind, t]);

  const isHistoryLoading = stream.historyLoad?.status === 'loading';
  const isHistoryUnavailable =
    isHistoryLoading || stream.historyLoad?.status === 'error';

  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const showMissingConfig = !isClientSecretInitializing && missingConfig;
  return {
    stream,
    setStream,
    activeProjectId,
    history,
    missingConfig,
    t,
    composer,
    messageNavigationEnabled,
    i18n,
    xpertPlatformClient,
    isHistoryUnavailable,
    isHistoryLoading,
    workbench,
    setHistoryError,
    missingConfigShortMessage,
    historyError,
    showMissingConfig,
    missingConfigDetailMessage,
    startScreen,
    theme,
    apiUrl,
    disclaimer,
  };
}
