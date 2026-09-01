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
  const { isParentAvailable, sendCommand, sendEvent } = useParentMessenger();
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
  const hostedApi =
    options?.api && 'getClientSecret' in options.api ? options.api : null;
  const configuredProjectId = hostedApi?.projectId ?? null;
  const projectsEnabled =
    Boolean(hostedApi) && options?.composer?.projects?.enabled === true;
  const projectCreationEnabled =
    projectsEnabled && options?.composer?.projects?.createEnabled !== false;
  const connectorsEnabled =
    Boolean(hostedApi) && options?.composer?.connectors?.enabled === true;
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(
    configuredProjectId,
  );
  const [scopedInitialThread, setScopedInitialThread] = React.useState<
    string | null
  >(options?.initialThread ?? null);
  const lastConfiguredProjectIdRef = React.useRef<string | null>(
    configuredProjectId,
  );
  const lastConfiguredInitialThreadRef = React.useRef<string | null>(
    options?.initialThread ?? null,
  );
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

  React.useEffect(() => {
    if (configuredProjectId === lastConfiguredProjectIdRef.current) return;
    lastConfiguredProjectIdRef.current = configuredProjectId;
    setActiveProjectId(configuredProjectId);
    setScopedInitialThread(options?.initialThread ?? null);
  }, [configuredProjectId, options?.initialThread]);

  React.useEffect(() => {
    const nextInitialThread = options?.initialThread ?? null;
    if (nextInitialThread === lastConfiguredInitialThreadRef.current) return;
    lastConfiguredInitialThreadRef.current = nextInitialThread;
    setScopedInitialThread(nextInitialThread);
  }, [options?.initialThread]);

  const handleProjectChange = React.useCallback(
    (projectId: string | null) => {
      const nextProjectId = projectId?.trim() || null;
      if (nextProjectId === activeProjectId) return;
      setActiveProjectId(nextProjectId);
      setScopedInitialThread(null);
      sendEvent('public_event', [
        'project.change',
        { projectId: nextProjectId },
      ]);
    },
    [activeProjectId, sendEvent],
  );
  const handleProjectCreate = React.useCallback(
    (name: string) => {
      sendEvent('public_event', [
        'effect',
        { name: 'project.create', data: { name } },
      ]);
    },
    [sendEvent],
  );
  const handleConnectorsChange = React.useCallback(
    (connectorBindingIds: string[]) => {
      sendEvent('public_event', ['connectors.change', { connectorBindingIds }]);
    },
    [sendEvent],
  );

  const chat = (
    <Chat
      className="flex-1"
      clientSecret={apiKey}
      options={options}
      isClientSecretInitializing={isClientSecretInitializing}
      activeProjectId={activeProjectId ?? undefined}
      projectsEnabled={projectsEnabled}
      connectorsEnabled={connectorsEnabled}
      onProjectChange={handleProjectChange}
      onProjectCreate={projectCreationEnabled ? handleProjectCreate : undefined}
      onConnectorsChange={handleConnectorsChange}
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
            projectId={activeProjectId ?? undefined}
            initialThread={scopedInitialThread}
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
