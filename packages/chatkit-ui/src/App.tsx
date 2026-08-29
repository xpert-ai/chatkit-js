import * as React from 'react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { A2UIProvider } from '@xpert-ai/a2ui-react';
import { Chat } from './components/chat';
import { StreamProvider } from './providers/Stream';
import { ThemeProvider } from './providers/Theme';
import { getLanguage, setLanguage } from './i18n';
import { useParentMessenger } from './hooks/useParentMessenger';
import { WorkbenchShell } from './workbench/WorkbenchShell';

export type AppProps = {
  options?: ChatKitOptions | null;
  clientSecret: string;
  organizationId?: string;
  resolvedXpertId?: string;
  isClientSecretInitializing?: boolean;
};

export function App({
  clientSecret,
  organizationId,
  resolvedXpertId,
  options,
  isClientSecretInitializing = false,
}: AppProps) {
  const { isParentAvailable, sendCommand } = useParentMessenger();
  const apiKey = clientSecret.trim() ? clientSecret : undefined;
  const xpertId = import.meta.env.VITE_XPERTAI_XPERT_ID as string | undefined;
  const apiUrl = import.meta.env.VITE_XPERTAI_API_URL as string | undefined;

  // Extract options
  const theme = options?.theme;
  const locale = options?.locale;
  const requestLocale = locale ?? getLanguage();
  const workbenchEnabled =
    options?.workbench?.enabled === true ||
    options?.workbench?.sideChat?.enabled === true;
  const [workbenchRequestContext, setWorkbenchRequestContext] = React.useState<
    Record<string, unknown>
  >({});
  const handleWorkbenchRequestContextChange = React.useCallback(
    (context: Record<string, unknown>) => {
      setWorkbenchRequestContext(context);
    },
    [],
  );

  React.useEffect(() => {
    if (!locale) return;
    setLanguage(locale);
  }, [locale]);

  const chat = (
    <Chat
      className="flex-1"
      clientSecret={apiKey}
      options={options}
      isClientSecretInitializing={isClientSecretInitializing}
    />
  );

  return (
    <ThemeProvider theme={theme}>
      <div className="flex h-screen">
        <A2UIProvider
          onAction={(action) => {
            if (isParentAvailable)
              sendCommand('onWidgetAction', {
                action: action.actionId,
                widgetItem: action.context,
              });
          }}
        >
          <StreamProvider
            apiKey={apiKey}
            organizationId={organizationId}
            apiUrl={options?.api.apiUrl || apiUrl}
            xpertId={options?.api.xpertId || resolvedXpertId || xpertId}
            projectId={
              options?.api && 'projectId' in options.api
                ? options.api.projectId
                : undefined
            }
            initialThread={options?.initialThread ?? null}
            locale={requestLocale}
            additionalContext={
              workbenchEnabled ? workbenchRequestContext : undefined
            }
          >
            {workbenchEnabled ? (
              <WorkbenchShell
                options={options}
                locale={requestLocale}
                onRequestContextChange={handleWorkbenchRequestContextChange}
              >
                {chat}
              </WorkbenchShell>
            ) : (
              chat
            )}
          </StreamProvider>
        </A2UIProvider>
      </div>
    </ThemeProvider>
  );
}

export default App;
