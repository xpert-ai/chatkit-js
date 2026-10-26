import { EditorLifecycleContext } from '../editors/context';
import { RemoteEditor } from '../editors/remote-editor';
import { safeRandomUUID } from '@xpert-ai/chatkit-web-shared';
import * as React from 'react';
import { isEqual } from 'lodash-es';
import type {
  Client,
  XpertViewQuery,
  XpertExtensionViewManifest,
  XpertRemoteViewHostEventMessage,
  XpertViewFileAccessSessionResult,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import { useTheme } from '../../providers/Theme';
import { createRemoteTheme } from './remote-theme';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { isWorkbenchDebugEnabled, workbenchDebug } from '../debug';
import { matchesHostEventSubscription } from '../host-events';
import { FileAccessUrls } from './file-access-urls';
import { readRemoteFile } from './file-access-queue';
import {
  REMOTE_COMPONENT_CHANNEL,
  REMOTE_COMPONENT_PROTOCOL_VERSION,
  createRemoteHostEvent,
  parseActionRequest,
  parseFileAccessPurpose,
  parseParameterOptionsQuery,
  parseRemoteComponentMessage,
  parseRemoteFile,
  parseViewQuery,
  readRequiredString,
  type RemoteComponentMessage,
} from '../protocol';

export type RemoteViewHostsClient = Pick<
  Client['viewHosts'],
  | 'getManifest'
  | 'getRemoteComponentEntry'
  | 'getData'
  | 'getParameterOptions'
  | 'executeAction'
  | 'executeFileAction'
  | 'createFileAccessSession'
  | 'createFileAccessGrant'
  | 'readFileAccess'
  | 'revokeFileAccessSession'
>;

type RemoteViewFrameProps = {
  instanceKey?: string;
  visible?: boolean;
  initialQuery?: XpertViewQuery;
  manifest: XpertExtensionViewManifest;
  hostId: string;
  runtimeScope?: XpertViewRuntimeScopeInput;
  contextReady?: boolean;
  locale: string;
  title: string;
  hostEvent: XpertRemoteViewHostEventMessage | null;
  viewHosts: RemoteViewHostsClient;
  onNotify: (level: 'success' | 'error', message: string) => void;
  onClientCommand: (
    commandKey: string,
    payload: unknown,
    manifest: XpertExtensionViewManifest,
  ) => Promise<unknown>;
};

const REMOTE_REQUEST_TIMEOUT_MS = 30_000;

export function RemoteViewFrame({
  instanceKey,
  visible = true,
  manifest: incomingManifest,
  initialQuery,
  hostId,
  runtimeScope,
  contextReady = true,
  locale,
  title,
  hostEvent,
  viewHosts,
  onNotify,
  onClientCommand,
}: RemoteViewFrameProps) {
  // Equal discovery results must not restart a load or revoke active file access.
  const listedManifestRef = React.useRef(incomingManifest);
  if (!isEqual(listedManifestRef.current, incomingManifest)) {
    listedManifestRef.current = incomingManifest;
  }
  const listedManifest = listedManifestRef.current;
  const { theme, isDarkMode, themeRootRef, themeRevision } = useTheme();
  const { t } = useChatkitTranslation();
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [manifest, setManifest] = React.useState(listedManifest);
  const [html, setHtml] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const instanceId = React.useMemo(
    () => `${manifest.key}:${safeRandomUUID()}`,
    [manifest.key, html],
  );
  const sessionRef = React.useRef<XpertViewFileAccessSessionResult | null>(
    null,
  );
  const sessionPromiseRef =
    React.useRef<Promise<XpertViewFileAccessSessionResult> | null>(null);
  const sessionEpochRef = React.useRef(0);
  const fileUrls = React.useMemo(
    () => new FileAccessUrls(viewHosts),
    [viewHosts],
  );
  const debounceRef = React.useRef(new Map<string, number>());
  const requestControllersRef = React.useRef(new Set<AbortController>());
  const activeRef = React.useRef(true);
  const visibleRef = React.useRef(visible);
  visibleRef.current = visible;
  const scopeKey = JSON.stringify([
    runtimeScope?.projectId ?? null,
    runtimeScope?.conversationId ?? null,
  ]);
  const contextRef = React.useRef({
    key: scopeKey,
    ready: contextReady,
    revision: 0,
    runtimeScope,
  });
  if (
    contextRef.current.key !== scopeKey ||
    contextRef.current.ready !== contextReady
  ) {
    contextRef.current = {
      key: scopeKey,
      ready: contextReady,
      revision: contextRef.current.revision + 1,
      runtimeScope,
    };
  }
  const revision = contextRef.current.revision;
  const [validatedRevision, setValidatedRevision] = React.useState(-1);
  const blocked = !contextReady || loading || validatedRevision !== revision;
  const initializedRef = React.useRef<{
    instanceId: string;
    revision: number;
    configurationKey: string;
  } | null>(null);

  const remoteTheme = React.useMemo(() => {
    // themeRevision changes only after ThemeProvider has applied the latest
    // options.theme values to its root element.
    void themeRevision;
    const element =
      themeRootRef.current ?? frameRef.current ?? document.documentElement;
    return createRemoteTheme(element, isDarkMode, theme.radius);
  }, [isDarkMode, theme.radius, themeRevision, themeRootRef]);

  // Revalidating a scope must not reset an already initialized remote view.
  // Theme, navigation and manifest changes still require an updated init payload.
  const configurationKey = JSON.stringify([
    manifest,
    initialQuery,
    locale,
    remoteTheme,
  ]);

  const sendToFrame = React.useCallback(
    (type: string, body: Record<string, unknown> = {}) => {
      frameRef.current?.contentWindow?.postMessage(
        {
          channel: REMOTE_COMPONENT_CHANNEL,
          protocolVersion: REMOTE_COMPONENT_PROTOCOL_VERSION,
          instanceId,
          type,
          ...body,
        },
        '*',
      );
    },
    [instanceId],
  );

  const editors = React.useContext(EditorLifecycleContext);
  const editorRef = React.useRef<RemoteEditor | null>(null);
  const resourceId = initialQuery?.selectionId;
  const isEditor = manifest.clientCommands?.some(
    (command) => command.key === 'workbench.content.status',
  );
  React.useLayoutEffect(() => {
    if (!editors || !resourceId || !isEditor) return;
    const editor = new RemoteEditor(
      editors,
      instanceId,
      instanceKey ?? manifest.key,
      resourceId,
      (payload) =>
        sendToFrame('editorEvent', { ...payload, scopeRevision: revision }),
    );
    editorRef.current = editor;
    return () => {
      editor.dispose();
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [
    editors,
    instanceId,
    manifest.key,
    instanceKey,
    resourceId,
    isEditor,
    revision,
    sendToFrame,
  ]);

  const revokeSession = React.useCallback(() => {
    fileUrls.clear();
    sessionEpochRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    sessionPromiseRef.current = null;
    if (session) {
      void viewHosts
        .revokeFileAccessSession(session.sessionId)
        .catch(() => undefined);
    }
  }, [viewHosts, fileUrls]);

  React.useEffect(() => {
    const controller = new AbortController();
    if (!contextReady) return;
    setError(null);
    setLoading(true);
    revokeSession();
    workbenchDebug.debug('entry.load.started', {
      viewKey: listedManifest.key,
      hostId,
    });

    // A long-lived Workbench may retain an older slot listing after deployment.
    // Revalidate the exact manifest before loading code; never broaden its allowlist locally.
    void viewHosts
      .getManifest('agent', hostId, listedManifest.key, {
        signal: controller.signal,
        runtimeScope,
      })
      .then(async (current) => {
        if (controller.signal.aborted) return null;
        if (
          current.key !== listedManifest.key ||
          current.hostType !== 'agent' ||
          current.visible === false ||
          current.view.type !== 'remote_component' ||
          current.view.component.isolation !== 'iframe'
        )
          throw new Error(t('workbench.entryUnavailable'));
        const entry = await viewHosts.getRemoteComponentEntry(
          'agent',
          hostId,
          current.key,
          {
            signal: controller.signal,
            runtimeScope,
          },
        );
        return { current, entry };
      })
      .then((loaded) => {
        if (controller.signal.aborted || !loaded) return;
        setManifest(loaded.current);
        setHtml(loaded.entry);
        setValidatedRevision(revision);
        workbenchDebug.debug('entry.load.completed', {
          viewKey: listedManifest.key,
        });
      })
      .catch((entryError: unknown) => {
        if (controller.signal.aborted) return;
        const message = getErrorMessage(
          entryError,
          t('workbench.entryUnavailable'),
        );
        setError(message);
        workbenchDebug.error('entry.load.failed', {
          viewKey: listedManifest.key,
          message,
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      revokeSession();
    };
  }, [
    hostId,
    listedManifest,
    revokeSession,
    runtimeScope,
    contextReady,
    revision,
    t,
    viewHosts,
  ]);

  const sendInit = React.useCallback(() => {
    if (
      !frameRef.current?.contentWindow ||
      !html ||
      blocked ||
      !contextRef.current.ready
    )
      return;
    const production = isProductionHost();
    sendToFrame('init', {
      visible: visibleRef.current && !document.hidden,
      manifest,
      payload: {},
      runtimeScope: {
        projectId: contextRef.current.runtimeScope?.projectId ?? null,
        conversationId: contextRef.current.runtimeScope?.conversationId ?? null,
      },
      scopeRevision: contextRef.current.revision,
      initialQuery: { ...createInitialQuery(manifest), ...initialQuery },
      locale,
      theme: remoteTheme,
      debug: {
        enabled: !production || isWorkbenchDebugEnabled(),
        production,
      },
    });
    initializedRef.current = {
      instanceId,
      revision: contextRef.current.revision,
      configurationKey,
    };
    workbenchDebug.debug('bridge.init.sent', { viewKey: manifest.key });
  }, [
    html,
    locale,
    manifest,
    remoteTheme,
    sendToFrame,
    initialQuery,
    instanceId,
    blocked,
    configurationKey,
  ]);

  React.useEffect(() => {
    const notifyVisibility = () =>
      sendToFrame('visibility', { visible: visible && !document.hidden });
    notifyVisibility();
    document.addEventListener('visibilitychange', notifyVisibility);
    return () =>
      document.removeEventListener('visibilitychange', notifyVisibility);
  }, [visible, sendToFrame]);

  const ensureFileAccessSession = React.useCallback(
    async (signal: AbortSignal) => {
      const current = sessionRef.current;
      if (
        current &&
        new Date(current.expiresAt).getTime() > Date.now() + 60_000
      ) {
        return current;
      }
      if (sessionPromiseRef.current) return sessionPromiseRef.current;

      const epoch = sessionEpochRef.current;
      const promise = viewHosts
        .createFileAccessSession('agent', hostId, manifest.key, {
          signal,
          runtimeScope,
        })
        .then(async (session) => {
          if (epoch !== sessionEpochRef.current) {
            await viewHosts
              .revokeFileAccessSession(session.sessionId)
              .catch(() => undefined);
            throw new Error(
              'Remote view file access session is no longer active.',
            );
          }
          sessionRef.current = session;
          return session;
        });
      sessionPromiseRef.current = promise;
      try {
        return await promise;
      } finally {
        if (sessionPromiseRef.current === promise) {
          sessionPromiseRef.current = null;
        }
      }
    },
    [hostId, manifest.key, runtimeScope, viewHosts],
  );

  const runRequest = React.useCallback(
    async (
      message: RemoteComponentMessage,
      responseType: string,
      operation: (signal: AbortSignal) => Promise<unknown>,
    ) => {
      const controller = new AbortController();
      requestControllersRef.current.add(controller);
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REMOTE_REQUEST_TIMEOUT_MS);
      try {
        const result = await operation(controller.signal);
        if (
          !activeRef.current ||
          controller.signal.aborted ||
          revision !== contextRef.current.revision ||
          !contextRef.current.ready
        )
          return;
        sendToFrame(responseType, {
          requestId: message.requestId,
          scopeRevision: revision,
          [responseType === 'data' ? 'data' : 'result']: result,
        });
      } catch (requestError: unknown) {
        if (
          !activeRef.current ||
          revision !== contextRef.current.revision ||
          !contextRef.current.ready
        )
          return;
        const requestMessage = timedOut
          ? t('workbench.errors.requestTimeout')
          : getErrorMessage(requestError, t('workbench.errors.requestFailed'));
        sendToFrame('error', {
          requestId: message.requestId,
          message: requestMessage,
        });
        // The requesting view owns recovery and presentation; notify is explicit in the bridge protocol.
        workbenchDebug.warn('bridge.request.failed', {
          viewKey: manifest.key,
          requestType: message.type,
          message: requestMessage,
        });
      } finally {
        window.clearTimeout(timeout);
        requestControllersRef.current.delete(controller);
      }
    },
    [manifest.key, sendToFrame, t, revision],
  );

  React.useLayoutEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = parseRemoteComponentMessage(event.data);
      if (!message || event.source !== frameRef.current?.contentWindow) return;
      if (message.type === 'ready') {
        sendInit();
        return;
      }
      if (message.instanceId !== instanceId) return;
      if (
        blocked ||
        (message.scopeRevision !== undefined &&
          message.scopeRevision !== revision)
      ) {
        if (message.requestId)
          sendToFrame('error', {
            requestId: message.requestId,
            code: 'context_changed',
            message: 'View context is changing. Retry in the current context.',
          });
        return;
      }

      // Editor acknowledgements require an exact revision, including revision zero.
      if (message.type === 'closePrepared') {
        if (
          message.scopeRevision === revision &&
          message.requestId &&
          typeof message.ready === 'boolean'
        )
          editorRef.current?.acknowledge(message.requestId, message.ready);
        return;
      }
      switch (message.type) {
        case 'resize':
          return;
        case 'notify': {
          const notification = readRequiredString(message.message);
          if (notification) {
            onNotify(
              message.level === 'error' ? 'error' : 'success',
              notification,
            );
          }
          return;
        }
        case 'requestData':
          void runRequest(message, 'data', (signal) =>
            viewHosts.getData(
              'agent',
              hostId,
              manifest.key,
              parseViewQuery(message.query),
              { signal, runtimeScope },
            ),
          );
          return;
        case 'requestParameterOptions':
          void runRequest(message, 'parameterOptions', async (signal) => {
            const parameterKey = readRequiredString(message.parameterKey);
            const parameter = manifest.parameters?.find(
              (candidate) => candidate.key === parameterKey,
            );
            if (!parameterKey || !parameter?.optionSource) {
              throw new Error(
                `Parameter '${parameterKey ?? ''}' is not available.`,
              );
            }
            return viewHosts.getParameterOptions(
              'agent',
              hostId,
              manifest.key,
              parameterKey,
              parseParameterOptionsQuery(message),
              { signal, runtimeScope },
            );
          });
          return;
        case 'executeAction':
          void runRequest(message, 'actionResult', async (signal) => {
            const actionKey = readRequiredString(message.actionKey);
            const action = manifest.actions?.find(
              (candidate) => candidate.key === actionKey,
            );
            if (
              !actionKey ||
              !action ||
              (action.transport ?? 'json') !== 'json'
            ) {
              throw new Error(`Action '${actionKey ?? ''}' is not available.`);
            }
            return viewHosts.executeAction(
              'agent',
              hostId,
              manifest.key,
              actionKey,
              parseActionRequest(message),
              { signal, runtimeScope },
            );
          });
          return;
        case 'executeFileAction':
          void runRequest(message, 'fileActionResult', async (signal) => {
            const actionKey = readRequiredString(message.actionKey);
            const action = manifest.actions?.find(
              (candidate) => candidate.key === actionKey,
            );
            const file = parseRemoteFile(message.file);
            if (
              !actionKey ||
              !action ||
              (action.transport ?? 'json') !== 'file'
            ) {
              throw new Error(
                `File action '${actionKey ?? ''}' is not available.`,
              );
            }
            if (!file) throw new Error('File is required.');
            return viewHosts.executeFileAction(
              'agent',
              hostId,
              manifest.key,
              actionKey,
              {
                ...parseActionRequest(message),
                file: new Blob([file.buffer], { type: file.type }),
                fileName: file.name,
              },
              { signal, runtimeScope },
            );
          });
          return;
        case 'requestFileAccess':
          void runRequest(message, 'fileAccessResult', async (signal) => {
            const fileKey = readRequiredString(message.fileKey);
            const purpose = parseFileAccessPurpose(message.purpose);
            if (!fileKey) throw new Error('File key is required.');
            if (!purpose || !manifest.fileAccess?.purposes.includes(purpose)) {
              throw new Error(
                `File access purpose '${String(message.purpose ?? '')}' is not available.`,
              );
            }
            const session = await ensureFileAccessSession(signal);
            signal.throwIfAborted();
            const targetId = readRequiredString(message.targetId) ?? undefined;
            return readRemoteFile(
              viewHosts,
              JSON.stringify([session.sessionId, fileKey, targetId, purpose]),
              signal,
              async (signal) => {
                const grant = await viewHosts.createFileAccessGrant(
                  session.sessionId,
                  {
                    fileKey,
                    purpose,
                    ...(targetId ? { targetId } : {}),
                  },
                  { signal },
                );
                signal.throwIfAborted();
                // The opaque-origin iframe cannot send the session's SameSite cookie.
                // Downloads need the same host transport as previews; returning the
                // cookie-bound URL makes an iframe's download request fail with 401.
                return fileUrls.create(grant, signal);
              },
              purpose === 'download',
            );
          });
          return;
        case 'invokeClientCommand':
          void runRequest(message, 'clientCommandResult', async () => {
            const commandKey = readRequiredString(message.commandKey);
            if (
              !commandKey ||
              !manifest.clientCommands?.some(
                (command) => command.key === commandKey,
              )
            ) {
              throw new Error(
                `Client command '${commandKey ?? ''}' is not available.`,
              );
            }
            if (commandKey === 'workbench.content.status') {
              const value = message.payload;
              if (
                message.scopeRevision !== revision ||
                !value ||
                typeof value !== 'object' ||
                !('resourceId' in value) ||
                typeof value.resourceId !== 'string' ||
                !('dirty' in value) ||
                typeof value.dirty !== 'boolean' ||
                ('title' in value &&
                  value.title !== undefined &&
                  typeof value.title !== 'string')
              )
                throw new Error('Invalid editor status.');
              return {
                success:
                  editorRef.current?.status(
                    value.resourceId,
                    value.dirty,
                    'title' in value && typeof value.title === 'string'
                      ? value.title
                      : undefined,
                  ) ?? false,
              };
            }
            return onClientCommand(commandKey, message.payload, manifest);
          });
          return;
        default:
          return;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    ensureFileAccessSession,
    blocked,
    revision,
    hostId,
    instanceId,
    manifest,
    onClientCommand,
    onNotify,
    runRequest,
    runtimeScope,
    sendInit,
    viewHosts,
    fileUrls,
  ]);

  React.useEffect(() => {
    const controllers = requestControllersRef.current;
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      for (const controller of controllers) controller.abort();
      controllers.clear();
    };
  }, []);

  React.useLayoutEffect(() => {
    for (const controller of requestControllersRef.current) controller.abort();
    requestControllersRef.current.clear();
    debounceRef.current.clear();
    revokeSession();
    if (!contextReady) frameRef.current?.blur();
  }, [revision, contextReady, revokeSession]);

  React.useEffect(() => {
    if (!html || blocked) return;
    const initialized = initializedRef.current;
    if (
      initialized?.instanceId === instanceId &&
      initialized.configurationKey === configurationKey
    ) {
      if (initialized.revision === revision) return;
      sendToFrame('hostEvent', {
        event: {
          id: `${instanceId}:context:${revision}`,
          type: 'view.context.changed',
          source: 'chatkit',
          receivedAt: new Date().toISOString(),
          data: {
            revision,
            runtimeScope: {
              projectId: runtimeScope?.projectId ?? null,
              conversationId: runtimeScope?.conversationId ?? null,
            },
          },
        },
      });
      initializedRef.current = { ...initialized, revision };
    } else {
      sendInit();
    }
  }, [
    html,
    blocked,
    instanceId,
    revision,
    configurationKey,
    runtimeScope,
    sendInit,
    sendToFrame,
  ]);

  React.useEffect(() => {
    if (!hostEvent || !html || blocked) return;
    for (const subscription of manifest.hostEvents?.subscriptions ?? []) {
      if (!matchesHostEventSubscription(hostEvent, subscription)) continue;
      const actionType = subscription.action?.type ?? 'refresh';
      if (actionType !== 'forward' && actionType !== 'refresh-and-forward') {
        continue;
      }
      const debounceMs = Math.max(0, subscription.action?.debounceMs ?? 0);
      const key = [
        subscription.key,
        hostEvent.type,
        hostEvent.toolName ??
          hostEvent.toolCallId ??
          hostEvent.runId ??
          hostEvent.id,
      ].join(':');
      const previous = debounceRef.current.get(key);
      const now = Date.now();
      if (
        previous !== undefined &&
        debounceMs > 0 &&
        now - previous < debounceMs
      ) {
        continue;
      }
      debounceRef.current.set(key, now);
      sendToFrame('hostEvent', {
        event: createRemoteHostEvent(hostEvent),
      });
    }
  }, [
    hostEvent,
    html,
    blocked,
    manifest.hostEvents?.subscriptions,
    sendToFrame,
  ]);

  if (loading && !html) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('workbench.loadingView')}
      </div>
    );
  }

  if (error || !html) {
    return (
      <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error ?? t('workbench.entryUnavailable')}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" aria-busy={blocked}>
      <iframe
        ref={frameRef}
        key={instanceId}
        className="block h-full w-full border-0 bg-background"
        title={title}
        inert={blocked}
        srcDoc={html}
        referrerPolicy="no-referrer"
        sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
        onLoad={sendInit}
      />
      {blocked && <div className="absolute inset-0" />}
    </div>
  );
}

function createInitialQuery(manifest: XpertExtensionViewManifest) {
  const pageSize = manifest.dataSource.querySchema?.defaultPageSize;
  return {
    page: 1,
    ...(pageSize ? { pageSize } : {}),
  };
}

function isProductionHost() {
  if (typeof window === 'undefined') return true;
  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return typeof error === 'string' && error.trim() ? error.trim() : fallback;
}
