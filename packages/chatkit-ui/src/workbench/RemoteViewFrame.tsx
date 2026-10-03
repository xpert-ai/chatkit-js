import * as React from 'react';
import type {
  Client,
  XpertViewQuery,
  XpertExtensionViewManifest,
  XpertRemoteViewHostEventMessage,
  XpertViewFileAccessSessionResult,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import { useTheme } from '../providers/Theme';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { isWorkbenchDebugEnabled, workbenchDebug } from './debug';
import { matchesHostEventSubscription } from './host-events';
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
} from './protocol';

export type RemoteViewHostsClient = Pick<
  Client['viewHosts'],
  | 'getRemoteComponentEntry'
  | 'getData'
  | 'getParameterOptions'
  | 'executeAction'
  | 'executeFileAction'
  | 'createFileAccessSession'
  | 'createFileAccessGrant'
  | 'revokeFileAccessSession'
>;

type RemoteViewFrameProps = {
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

type RemoteTheme = {
  mode: 'light' | 'dark';
  tokens: Record<string, string>;
};

const REMOTE_REQUEST_TIMEOUT_MS = 30_000;

export function RemoteViewFrame({
  manifest,
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
  const { isDarkMode, themeRootRef, themeRevision } = useTheme();
  const { t } = useChatkitTranslation();
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const instanceId = React.useMemo(
    () => `${manifest.key}:${createNonce()}`,
    [manifest.key, html],
  );
  const sessionRef = React.useRef<XpertViewFileAccessSessionResult | null>(
    null,
  );
  const sessionPromiseRef =
    React.useRef<Promise<XpertViewFileAccessSessionResult> | null>(null);
  const sessionEpochRef = React.useRef(0);
  const debounceRef = React.useRef(new Map<string, number>());
  const requestControllersRef = React.useRef(new Set<AbortController>());
  const activeRef = React.useRef(true);
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
  } | null>(null);

  const remoteTheme = React.useMemo(() => {
    // themeRevision changes only after ThemeProvider has applied the latest
    // options.theme values to its root element.
    void themeRevision;
    const element =
      themeRootRef.current ?? frameRef.current ?? document.documentElement;
    return createRemoteTheme(element, isDarkMode);
  }, [isDarkMode, themeRevision, themeRootRef]);

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

  const revokeSession = React.useCallback(() => {
    sessionEpochRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    sessionPromiseRef.current = null;
    if (session) {
      void viewHosts
        .revokeFileAccessSession(session.sessionId)
        .catch(() => undefined);
    }
  }, [viewHosts]);

  React.useEffect(() => {
    const controller = new AbortController();
    if (!contextReady) return;
    setError(null);
    setLoading(true);
    revokeSession();
    workbenchDebug.debug('entry.load.started', {
      viewKey: manifest.key,
      hostId,
    });

    void viewHosts
      .getRemoteComponentEntry('agent', hostId, manifest.key, {
        signal: controller.signal,
        runtimeScope,
      })
      .then((entry) => {
        if (controller.signal.aborted) return;
        setHtml(entry);
        setValidatedRevision(revision);
        workbenchDebug.debug('entry.load.completed', {
          viewKey: manifest.key,
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
          viewKey: manifest.key,
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
    manifest.key,
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
  ]);

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
        onNotify('error', requestMessage);
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
    [manifest.key, onNotify, sendToFrame, t, revision],
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
                file: file.buffer,
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
            return viewHosts.createFileAccessGrant(
              session.sessionId,
              {
                fileKey,
                purpose,
                ...(readRequiredString(message.targetId)
                  ? {
                      targetId:
                        readRequiredString(message.targetId) ?? undefined,
                    }
                  : {}),
              },
              { signal },
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
      initialized.revision !== revision
    ) {
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
      initializedRef.current = { instanceId, revision };
    } else {
      sendInit();
    }
  }, [
    html,
    blocked,
    instanceId,
    revision,
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

function createNonce() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isProductionHost() {
  if (typeof window === 'undefined') return true;
  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return typeof error === 'string' && error.trim() ? error.trim() : fallback;
}

function createRemoteTheme(
  element: HTMLElement,
  isDarkMode: boolean,
): RemoteTheme {
  const style = getComputedStyle(element);
  const bodyStyle = getComputedStyle(document.body);
  const mode = isDarkMode ? 'dark' : 'light';
  const background = readThemeColor(
    style,
    '--background',
    isDarkMode ? '#16181c' : '#ffffff',
  );
  const foreground = readThemeColor(
    style,
    '--foreground',
    isDarkMode ? '#e3e3e3' : '#18181b',
  );
  const card = readThemeColor(style, '--card', background);
  const cardForeground = readThemeColor(style, '--card-foreground', foreground);
  const popover = readThemeColor(style, '--popover', card);
  const popoverForeground = readThemeColor(
    style,
    '--popover-foreground',
    cardForeground,
  );
  const muted = readThemeColor(
    style,
    '--muted',
    isDarkMode ? '#26272b' : '#f4f4f5',
  );
  const mutedForeground = readThemeColor(
    style,
    '--muted-foreground',
    isDarkMode ? '#a3a3a3' : '#71717a',
  );
  const secondary = readThemeColor(style, '--secondary', muted);
  const secondaryForeground = readThemeColor(
    style,
    '--secondary-foreground',
    foreground,
  );
  const accent = readThemeColor(style, '--accent', muted);
  const accentForeground = readThemeColor(
    style,
    '--accent-foreground',
    foreground,
  );
  const primary = readThemeColor(
    style,
    '--primary',
    isDarkMode ? '#3b82f6' : '#18181b',
  );
  const primaryForeground = readThemeColor(
    style,
    '--primary-foreground',
    '#ffffff',
  );
  const destructive = readThemeColor(
    style,
    '--destructive',
    isDarkMode ? '#f87171' : '#dc2626',
  );
  const success = readThemeColor(style, '--success', '#047857');
  const radius = readThemeValue(style, '--radius', '0.625rem');

  return {
    mode,
    tokens: {
      fontFamily:
        readThemeValue(style, '--font-sans') ||
        bodyStyle.fontFamily ||
        'Inter, ui-sans-serif, system-ui, sans-serif',
      colorBackground: background,
      colorForeground: foreground,
      colorCard: card,
      colorCardForeground: cardForeground,
      colorPopover: popover,
      colorPopoverForeground: popoverForeground,
      colorSecondary: secondary,
      colorSecondaryForeground: secondaryForeground,
      colorMuted: muted,
      colorMutedForeground: mutedForeground,
      colorAccent: accent,
      colorAccentForeground: accentForeground,
      colorBorder: readThemeColor(
        style,
        '--border',
        isDarkMode ? '#27272a' : '#e4e4e7',
      ),
      colorInput: readThemeColor(
        style,
        '--input',
        isDarkMode ? '#52525b' : '#d4d4d8',
      ),
      colorPrimary: primary,
      colorPrimaryForeground: primaryForeground,
      colorDestructive: destructive,
      colorDestructiveForeground: readThemeColor(
        style,
        '--destructive-foreground',
        primaryForeground,
      ),
      colorDestructiveBackground: isDarkMode
        ? 'color-mix(in srgb, var(--xui-color-destructive) 18%, var(--xui-color-background))'
        : 'color-mix(in srgb, var(--xui-color-destructive) 9%, var(--xui-color-background))',
      colorSuccess: success,
      colorSuccessBackground: isDarkMode
        ? 'color-mix(in srgb, var(--xui-color-success) 18%, var(--xui-color-background))'
        : 'color-mix(in srgb, var(--xui-color-success) 9%, var(--xui-color-background))',
      colorWarning: readThemeColor(style, '--warning', primary),
      colorInfo: readThemeColor(style, '--info', primary),
      colorRing: readThemeColor(style, '--ring', primary),
      colorChart1: readThemeColor(style, '--chart-1', primary),
      colorChart2: readThemeColor(style, '--chart-2', success),
      colorChart3: readThemeColor(style, '--chart-3', primary),
      colorChart4: readThemeColor(style, '--chart-4', destructive),
      colorChart5: readThemeColor(style, '--chart-5', accentForeground),
      radiusSm: `calc(${radius} - 4px)`,
      radiusMd: `calc(${radius} - 2px)`,
      radiusLg: radius,
      fontSizeXs: readThemeValue(
        style,
        '--workbench-extension-font-size-xs',
        '0.75rem',
      ),
      fontSizeSm: readThemeValue(
        style,
        '--workbench-extension-font-size-sm',
        '0.8125rem',
      ),
      fontSizeMd: readThemeValue(
        style,
        '--workbench-extension-font-size-md',
        '0.875rem',
      ),
      fontSizeLg: readThemeValue(
        style,
        '--workbench-extension-font-size-lg',
        '1rem',
      ),
      fontSizeControl: readThemeValue(
        style,
        '--workbench-extension-font-size-control',
        '0.8125rem',
      ),
      fontSizeButton: readThemeValue(
        style,
        '--workbench-extension-font-size-button',
        '0.8125rem',
      ),
      fontSizeTable: readThemeValue(
        style,
        '--workbench-extension-font-size-table',
        '0.8125rem',
      ),
      controlHeight: readThemeValue(
        style,
        '--workbench-extension-control-height',
        '2rem',
      ),
      buttonHeight: readThemeValue(
        style,
        '--workbench-extension-button-height',
        '2rem',
      ),
      buttonHeightSm: readThemeValue(
        style,
        '--workbench-extension-button-height-sm',
        '1.75rem',
      ),
    },
  };
}

function readThemeValue(
  style: CSSStyleDeclaration,
  name: string,
  fallback = '',
) {
  return style.getPropertyValue(name).trim() || fallback;
}

function readThemeColor(
  style: CSSStyleDeclaration,
  name: string,
  fallback: string,
) {
  const value = readThemeValue(style, name);
  if (!value) return fallback;
  const resolved = resolveCssVariable(style, value);
  if (/^(#|rgb|hsl|oklch|color-mix)/i.test(resolved)) return resolved;
  return `hsl(${resolved})`;
}

function resolveCssVariable(
  style: CSSStyleDeclaration,
  value: string,
  depth = 0,
): string {
  if (depth > 4 || !value.startsWith('var(')) return value;
  const match = /^var\(\s*(--[^,\s)]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (!match) return value;
  const variableName = match[1];
  if (!variableName) return value;
  const resolved =
    style.getPropertyValue(variableName).trim() || match[2]?.trim() || '';
  return resolved ? resolveCssVariable(style, resolved, depth + 1) : value;
}
