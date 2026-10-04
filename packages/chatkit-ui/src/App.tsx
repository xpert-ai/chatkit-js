import type { XpertProjectTypeRef } from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import type { ChatKitOptions, ProjectSelection } from '@xpert-ai/chatkit-types';
import { A2UIProvider } from '@xpert-ai/a2ui-react';
import { Chat } from './components/chat';
import { StreamProvider } from './providers/Stream';
import { ThemeProvider } from './providers/Theme';
import { getLanguage, setLanguage } from './i18n';
import { useParentMessenger } from './hooks/useParentMessenger';
import { useWorkbenchNavigation } from './workbench/useWorkbenchNavigation';
import { useWindowDragRegions } from './hooks/useWindowDragRegions';
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
  useWindowDragRegions(options?.header?.windowDrag === true);
  const navigation = useWorkbenchNavigation(options, organizationId);
  const apiKey =
    navigation.session?.secret ||
    (clientSecret.trim() ? clientSecret : undefined);
  const activeOptions = navigation.session
    ? {
        ...options!,
        initialThread: navigation.session.threadId,
        api: {
          ...options!.api,
          xpertId: navigation.session.assistantId,
          projectId: navigation.session.projectId ?? undefined,
        },
        header: {
          ...options?.header,
          title: { ...options?.header?.title, text: undefined },
        },
      }
    : options;
  const xpertId = import.meta.env.VITE_XPERTAI_XPERT_ID as string | undefined;
  const apiUrl = import.meta.env.VITE_XPERTAI_API_URL as string | undefined;

  // Extract options
  const theme = options?.theme;
  const locale = options?.locale;
  const requestLocale = locale ?? getLanguage();
  const workbenchEnabled =
    options?.workbench?.externalAssistants?.enabled !== false ||
    options?.workbench?.enabled === true ||
    options?.workbench?.sideChat?.enabled === true;
  const hostedApi =
    options?.api && 'getClientSecret' in options.api ? options.api : null;
  const configuredProjectId = hostedApi?.projectId ?? null;
  const configuredSelection: ProjectSelection | undefined =
    options?.composer?.projects?.selection ??
    (configuredProjectId
      ? { mode: 'existing', projectId: configuredProjectId }
      : options?.composer?.projects?.autoNewEnabled
        ? { mode: 'auto-new' }
        : undefined);
  const configuredSelectionKey = JSON.stringify(configuredSelection);
  const projectsEnabled =
    Boolean(hostedApi) && options?.composer?.projects?.enabled === true;
  const projectCreationEnabled =
    projectsEnabled && options?.composer?.projects?.createEnabled !== false;
  const connectorsEnabled =
    Boolean(hostedApi) && options?.composer?.connectors?.enabled === true;
  const [projectSelection, setProjectSelection] =
    React.useState(configuredSelection);
  const activeProjectId =
    projectSelection?.mode === 'existing' ? projectSelection.projectId : null;
  const [scopedInitialThread, setScopedInitialThread] = React.useState<
    string | null
  >(options?.initialThread ?? null);
  const lastConfiguredSelectionRef = React.useRef(configuredSelectionKey);
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
    if (configuredSelectionKey === lastConfiguredSelectionRef.current) return;
    lastConfiguredSelectionRef.current = configuredSelectionKey;
    setProjectSelection(configuredSelection);
    setScopedInitialThread(options?.initialThread ?? null);
  }, [configuredSelectionKey, configuredSelection, options?.initialThread]);

  React.useEffect(() => {
    const nextInitialThread = options?.initialThread ?? null;
    if (nextInitialThread === lastConfiguredInitialThreadRef.current) return;
    lastConfiguredInitialThreadRef.current = nextInitialThread;
    setScopedInitialThread(nextInitialThread);
  }, [options?.initialThread]);

  const handleProjectChange = React.useCallback(
    (projectId: string | null, selection?: ProjectSelection) => {
      const nextProjectId = projectId?.trim() || null;
      const nextSelection =
        selection ??
        (nextProjectId
          ? { mode: 'existing' as const, projectId: nextProjectId }
          : { mode: 'none' as const });
      setProjectSelection(nextSelection);
      setScopedInitialThread(null);
      setWorkbenchRequestContext({});
      sendEvent('public_event', [
        'project.change',
        { projectId: nextProjectId, selection: nextSelection },
      ]);
    },
    [sendEvent],
  );
  const handleProjectCreate = React.useCallback(
    (name: string, projectType?: XpertProjectTypeRef) => {
      sendEvent('public_event', [
        'effect',
        {
          name: 'project.create',
          data: {
            name,
            ...(projectType
              ? {
                  projectType: {
                    applicationKey: projectType.applicationKey,
                    projectTypeKey: projectType.projectTypeKey,
                  },
                }
              : {}),
          },
        },
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
      key={JSON.stringify([
        navigation.revision ?? 'host',
        activeProjectId,
        projectSelection?.mode,
      ])}
      className="flex-1"
      clientSecret={apiKey}
      options={activeOptions}
      isClientSecretInitializing={isClientSecretInitializing}
      projectSelection={navigation.session ? undefined : projectSelection}
      activeProjectId={
        navigation.session
          ? (navigation.session.projectId ?? undefined)
          : (activeProjectId ?? undefined)
      }
      projectsEnabled={projectsEnabled && !navigation.session}
      connectorsEnabled={connectorsEnabled}
      onProjectChange={handleProjectChange}
      onProjectCreate={projectCreationEnabled ? handleProjectCreate : undefined}
      onProjectTypeCreate={
        projectCreationEnabled
          ? (projectType) =>
              sendEvent('public_event', [
                'effect',
                {
                  name: 'project.create-entry',
                  data: {
                    applicationKey: projectType.applicationKey,
                    projectTypeKey: projectType.projectTypeKey,
                  },
                },
              ])
          : undefined
      }
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
            runtimeKey={navigation.revision ?? 'host'}
            threadStateMode={navigation.session ? 'memory' : 'url'}
            apiKey={apiKey}
            organizationId={
              navigation.session?.organizationId ?? organizationId
            }
            getClientSecret={navigation.refresh}
            apiUrl={options?.api.apiUrl || apiUrl}
            xpertId={
              navigation.session?.assistantId ||
              options?.api.xpertId ||
              resolvedXpertId ||
              xpertId
            }
            projectId={
              navigation.session
                ? (navigation.session.projectId ?? undefined)
                : (activeProjectId ?? undefined)
            }
            projectSelection={navigation.session ? undefined : projectSelection}
            initialThread={
              navigation.session
                ? navigation.session.threadId
                : scopedInitialThread
            }
            locale={requestLocale}
            additionalContext={
              workbenchEnabled ? workbenchRequestContext : undefined
            }
          >
            {workbenchEnabled ? (
              <WorkbenchShell
                options={activeOptions}
                locale={requestLocale}
                onRequestContextChange={handleWorkbenchRequestContextChange}
                onNavigate={navigation.navigate}
                initialNavigation={navigation.request}
                initializing={isClientSecretInitializing}
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
