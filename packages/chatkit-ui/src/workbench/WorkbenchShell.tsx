import * as React from 'react';
import {
  ASSISTANT_CHAT_SEND_MESSAGE_COMMAND,
  ASSISTANT_CONTEXT_SET_COMMAND,
  type XpertExtensionViewManifest,
  type XpertRemoteViewHostEventMessage,
} from '@xpert-ai/xpert-sdk';
import type {
  ChatKitOptions,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
  ChatRequestFile,
  FollowUpBehavior,
} from '@xpert-ai/chatkit-types';
import { useStreamContext } from '../providers/Stream';
import { useParentMessenger } from '../hooks/useParentMessenger';
import { buildInjectedRequestOptions } from '../lib/request-options';
import { isRuntimeCapabilitiesSelection } from '../lib/message-metadata';
import {
  buildHumanMessageInputPayload,
  normalizeReferences,
} from '../lib/references';
import { createMessageId } from '../lib/utils';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { cn } from '../lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../components/ui/sheet';
import {
  CHATKIT_INTERNAL_PARENT_EVENT,
  normalizeChatKitHostEvent,
} from './host-events';
import { WorkbenchContext, type WorkbenchContextValue } from './context';
import {
  EXTERNAL_ASSISTANTS_VIEW_KEY,
  collectExternalAssistantRuns,
  toWorkbenchMessages,
} from './external-assistant-runs';
import {
  isSideChatCloseConfirmationDisabled,
  persistSideChatCloseConfirmationDisabled,
  SideChatCloseDialog,
} from './SideChatCloseDialog';

export { useWorkbench, WorkbenchToggleButton } from './context';
import {
  WorkbenchPanel,
  SIDE_CHAT_VIEW_KEY,
  type SideChatSession,
} from './WorkbenchPanel';

import { useWorkbenchResize } from './useWorkbenchResize';
import { useWorkbenchLayout } from './useWorkbenchLayout';
import { workbenchLayoutKey } from './layout-storage';
import { CHAT_MIN_WIDTH, WORKBENCH_MIN_WIDTH, clampPanelWidth } from './split-resize';

const WORKBENCH_SLOT = 'agent.workbench.fixed';
const isNativeView = (key: string | null) =>
  key === SIDE_CHAT_VIEW_KEY || key === EXTERNAL_ASSISTANTS_VIEW_KEY;
const NARROW_BREAKPOINT = 960;
export type WorkbenchAssistantContext = {
  env?: Record<string, string>;
  context?: Record<string, unknown>;
};

type WorkbenchShellProps = {
  options?: ChatKitOptions | null;
  locale: string;
  children: React.ReactNode;
  onRequestContextChange: (context: Record<string, unknown>) => void;
};

export function WorkbenchShell({
  options,
  locale,
  children,
  onRequestContextChange,
}: WorkbenchShellProps) {
  const { t } = useChatkitTranslation();
  const stream = useStreamContext();
  const parentMessenger = useParentMessenger();
  const remoteViewsEnabled = options?.workbench?.enabled === true;
  const sideChatEnabled = options?.workbench?.sideChat?.enabled === true;
  const externalAssistantsEnabled =
    options?.workbench?.externalAssistants?.enabled !== false;
  const workbenchMessages = React.useMemo(
    () => toWorkbenchMessages(stream.messages ?? []),
    [stream.messages],
  );
  const externalRuns = React.useMemo(
    () => collectExternalAssistantRuns(workbenchMessages),
    [workbenchMessages],
  );
  const hasExternalRuns = externalAssistantsEnabled && externalRuns.length > 0;
  const enabled = remoteViewsEnabled || sideChatEnabled || hasExternalRuns;
  const externalScope = `${stream.assistantId}:${stream.threadId ?? stream.conversationId ?? ''}`;
  const [externalSession, setExternalSession] = React.useState<{
    scope: string;
    selectedId: string | null;
  } | null>(null);
  const externalViewOpen =
    externalAssistantsEnabled && externalSession?.scope === externalScope;
  const authenticated = Boolean(stream.apiKey.trim());
  const viewHosts = stream.client.viewHosts;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [views, setViews] = React.useState<XpertExtensionViewManifest[]>([]);
  const [viewsScope, setViewsScope] = React.useState<string | null>(null);
  const [activeViewKey, setActiveViewKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = React.useState(0);
  const [notification, setNotification] = React.useState<{
    level: 'success' | 'error';
    message: string;
  } | null>(null);
  const [hostEvent, setHostEvent] =
    React.useState<XpertRemoteViewHostEventMessage | null>(null);
  const [sideChat, setSideChat] = React.useState<SideChatSession | null>(null);
  const [sideChatOpening, setSideChatOpening] = React.useState(false);
  const [sideChatCloseDialogOpen, setSideChatCloseDialogOpen] =
    React.useState(false);
  const [
    sideChatCloseConfirmationDisabled,
    setSideChatCloseConfirmationDisabled,
  ] = React.useState(isSideChatCloseConfirmationDisabled);
  const sideThreadBySourceRef = React.useRef(
    new Map<string, string | Promise<string>>(),
  );
  const contextsRef = React.useRef(
    new Map<string, WorkbenchAssistantContext>(),
  );
  const isNarrow = containerWidth > 0 && containerWidth < NARROW_BREAKPOINT;
  const layoutKey = workbenchLayoutKey(
    stream.apiUrl, stream.organizationId, stream.assistantId,
  );
  const {
    requestedOpen, expanded, restoring, resolvedPanelWidth,
    setOpen, setExpanded, setPanelWidth, dismiss,
  } = useWorkbenchLayout(layoutKey, containerWidth, isNarrow);
  const open = requestedOpen && enabled && authenticated && (
    !restoring || (containerWidth >= NARROW_BREAKPOINT &&
      viewsScope === layoutKey && views.length > 0 && !loading)
  );

  React.useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry?.contentRect.width ?? 0);
      setContainerWidth(nextWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!remoteViewsEnabled || !authenticated || !stream.assistantId.trim()) {
      setViews([]);
      setError(null);
      setLoading(false);
      if (!sideChatEnabled && !externalAssistantsEnabled) {
        setActiveViewKey(null);
      }
      contextsRef.current.clear();
      onRequestContextChange({});
      return;
    }

    const controller = new AbortController();
    setViews([]);
    setViewsScope(null);
    setActiveViewKey((current) => (isNativeView(current) ? current : null));
    setLoading(true);
    setError(null);
    setNotification(null);
    setHostEvent(null);
    contextsRef.current.clear();
    onRequestContextChange({});
    void viewHosts
      .listSlotViews('agent', stream.assistantId, WORKBENCH_SLOT, {
        signal: controller.signal,
      })
      .then((manifests) => {
        if (controller.signal.aborted) return;
        const supported = manifests
          .filter(isSupportedWorkbenchView)
          .sort(compareWorkbenchViews);
        setViews(supported);
        setViewsScope(layoutKey);
        setActiveViewKey((current) =>
          isNativeView(current) ||
          (current && supported.some((view) => view.key === current))
            ? current
            : (supported[0]?.key ?? null),
        );
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setViews([]);
        setActiveViewKey((current) => (isNativeView(current) ? current : null));
        setError(getErrorMessage(loadError, t('workbench.loadFailed')));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    externalAssistantsEnabled,
    sideChatEnabled,
    remoteViewsEnabled,
    authenticated,
    locale,
    onRequestContextChange,
    reloadVersion,
    stream.assistantId,
    t,
    viewHosts,
    layoutKey,
  ]);

  React.useEffect(() => {
    if (!enabled) return;
    const handleHostEvent = (event: Event) => {
      const normalized = normalizeChatKitHostEvent(event, stream.threadId);
      if (normalized) setHostEvent(normalized);
    };
    window.addEventListener(CHATKIT_INTERNAL_PARENT_EVENT, handleHostEvent);
    return () =>
      window.removeEventListener(
        CHATKIT_INTERNAL_PARENT_EVENT,
        handleHostEvent,
      );
  }, [enabled, stream.threadId]);

  React.useEffect(() => {
    if (
      externalSession &&
      (!externalAssistantsEnabled || externalSession.scope !== externalScope)
    ) {
      setExternalSession(null);
      if (activeViewKey === EXTERNAL_ASSISTANTS_VIEW_KEY) {
        setActiveViewKey(
          sideChat ? SIDE_CHAT_VIEW_KEY : (views[0]?.key ?? null),
        );
        if (!sideChat && !views.length) {
          dismiss();
        }
      }
    }
  }, [
    externalAssistantsEnabled,
    externalScope,
    externalSession,
    activeViewKey,
    sideChat,
    views,
    dismiss,
  ]);

  const openExternalAssistant = React.useCallback(
    (executionId: string) => {
      if (
        !externalAssistantsEnabled ||
        !externalRuns.some((run) => run.id === executionId)
      )
        return;
      setExternalSession({ scope: externalScope, selectedId: executionId });
      setActiveViewKey(EXTERNAL_ASSISTANTS_VIEW_KEY);
      setOpen(true);
    },
    [externalAssistantsEnabled, externalRuns, externalScope, setOpen],
  );

  const activeView =
    views.find((view) => view.key === activeViewKey) ?? views[0] ?? null;

  const askInSideChat = React.useCallback(
    async (reference: ChatKitReference) => {
      if (!sideChatEnabled) return;
      const sourceThreadId = stream.threadId?.trim();
      if (!sourceThreadId) {
        throw new Error(t('workbench.sideChat.threadRequired'));
      }

      setActiveViewKey(SIDE_CHAT_VIEW_KEY);
      setOpen(true);
      setSideChatOpening(true);
      try {
        let cachedThread = sideThreadBySourceRef.current.get(sourceThreadId);
        if (!cachedThread) {
          cachedThread = stream.client.threads
            .copy(sourceThreadId)
            .then((copiedThread) => copiedThread.thread_id);
          sideThreadBySourceRef.current.set(sourceThreadId, cachedThread);
        }
        const sideThreadId = await cachedThread;
        sideThreadBySourceRef.current.set(sourceThreadId, sideThreadId);

        setSideChat((current) => ({
          sourceThreadId,
          threadId: sideThreadId,
          title:
            current?.sourceThreadId === sourceThreadId
              ? current.title
              : (reference.type === 'thread' ? reference.label || reference.threadId : reference.text).trim().slice(0, 32) ||
                t('workbench.sideChat.title'),
          referenceRequest: {
            id: `${Date.now()}-${(reference.type === 'thread' ? reference.threadId : reference.text).slice(0, 24)}`,
            reference,
          },
        }));
      } catch (copyError) {
        sideThreadBySourceRef.current.delete(sourceThreadId);
        throw copyError;
      } finally {
        setSideChatOpening(false);
      }
    },
    [sideChatEnabled, stream.client.threads, stream.threadId, t, setOpen],
  );

  const publishContexts = React.useCallback(() => {
    onRequestContextChange(buildWorkbenchRequestContext(contextsRef.current));
  }, [onRequestContextChange]);

  const executeClientCommand = React.useCallback(
    async (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ): Promise<unknown> => {
      if (commandKey === ASSISTANT_CONTEXT_SET_COMMAND) {
        const parsed = parseContextSetPayload(payload);
        if (!parsed.key) {
          throw new Error(t('workbench.errors.contextKeyRequired'));
        }
        if (parsed.clear) {
          contextsRef.current.delete(parsed.key);
        } else {
          contextsRef.current.set(parsed.key, {
            ...(parsed.env ? { env: parsed.env } : {}),
            ...(parsed.context ? { context: parsed.context } : {}),
          });
        }
        publishContexts();
        return {
          success: true,
          status: parsed.clear ? 'cleared' : 'updated',
          key: parsed.key,
        };
      }

      if (commandKey === ASSISTANT_CHAT_SEND_MESSAGE_COMMAND) {
        const message = parseChatMessagePayload(payload);
        const humanInput = buildHumanMessageInputPayload({
          content: message.text,
          references: message.references,
          referenceComposition: message.referenceComposition,
        });
        if (!humanInput) {
          throw new Error(t('workbench.errors.messageRequired'));
        }
        const input = {
          ...humanInput,
          ...(message.files.length > 0 ? { files: message.files } : {}),
          ...(message.planMode ? { planMode: true } : {}),
          ...(message.runtimeCapabilities
            ? { runtimeCapabilities: message.runtimeCapabilities }
            : {}),
        };
        const requestOptions = buildInjectedRequestOptions({
          defaults: options?.request,
          state: message.state,
          humanInput: input,
        });
        const messageId = message.clientMessageId ?? createMessageId();
        const followUpMode = stream.isLoading
          ? (message.followUpMode ?? 'queue')
          : undefined;
        void stream
          .submit(
            {
              input,
              ...(requestOptions.state ? { state: requestOptions.state } : {}),
              ...(message.clientMessageId
                ? { id: message.clientMessageId }
                : {}),
            },
            {
              ...(message.newThread ? { newThread: true } : {}),
              ...(followUpMode ? { followUpMode } : {}),
              ...(requestOptions.context
                ? { context: requestOptions.context }
                : {}),
              ...(requestOptions.config
                ? { config: requestOptions.config }
                : {}),
              ...(!followUpMode
                ? {
                    optimisticValues: (previous) => ({
                      ...previous,
                      messages: [
                        ...(previous.messages ?? []),
                        {
                          id: messageId,
                          type: 'human',
                          content: message.text,
                          submittedInput: humanInput.input,
                          ...(message.files.length > 0
                            ? { fileAssets: message.files }
                            : {}),
                          ...(message.references.length > 0
                            ? { references: message.references }
                            : {}),
                          ...(humanInput.referenceComposition
                            ? {
                                referenceComposition:
                                  humanInput.referenceComposition,
                              }
                            : {}),
                          ...(message.runtimeCapabilities
                            ? {
                                runtimeCapabilities:
                                  message.runtimeCapabilities,
                              }
                            : {}),
                        },
                      ],
                    }),
                  }
                : {}),
            },
          )
          .catch((submitError: unknown) => {
            setNotification({
              level: 'error',
              message: getErrorMessage(
                submitError,
                t('workbench.errors.sendFailed'),
              ),
            });
          });
        return {
          success: true,
          status: 'sent',
          ...(message.clientMessageId
            ? { clientMessageId: message.clientMessageId }
            : {}),
          ...(stream.threadId ? { threadId: stream.threadId } : {}),
        };
      }

      const request = {
        commandKey,
        payload,
        hostType: 'agent' as const,
        hostId: stream.assistantId,
        viewKey: manifest.key,
      };
      const directHandler = options?.workbench?.onClientCommand;
      if (typeof directHandler === 'function') {
        return directHandler(request);
      }
      if (parentMessenger.isParentAvailable) {
        return parentMessenger.sendCommand('onWorkbenchClientCommand', request);
      }
      throw new Error(
        t('workbench.errors.clientCommandUnavailable', { commandKey }),
      );
    },
    [
      options?.request,
      options?.workbench?.onClientCommand,
      parentMessenger,
      publishContexts,
      stream,
      t,
    ],
  );

  const available =
    hasExternalRuns ||
    (enabled &&
      authenticated &&
      Boolean(stream.assistantId.trim()) &&
      (Boolean(sideChat) || (remoteViewsEnabled && !loading)));
  const disabledReason = hasExternalRuns
    ? undefined
    : !stream.assistantId.trim()
      ? t('workbench.missingAssistant')
      : !authenticated
        ? t('workbench.loading')
        : loading
          ? t('workbench.loading')
          : error
            ? t('workbench.loadFailed')
            : views.length === 0 && !sideChatEnabled
              ? t('workbench.empty')
              : undefined;
  const closeWorkbench = React.useCallback(() => {
    setOpen(false);
    setExpanded(false);
  }, [setOpen, setExpanded]);
  const closeSideChat = React.useCallback(() => {
    if (sideChat?.sourceThreadId) {
      sideThreadBySourceRef.current.delete(sideChat.sourceThreadId);
    }
    setSideChat(null);
    setSideChatOpening(false);
    setSideChatCloseDialogOpen(false);
    const nextViewKey = externalViewOpen
      ? EXTERNAL_ASSISTANTS_VIEW_KEY
      : (views[0]?.key ?? null);
    setActiveViewKey(nextViewKey);
    if (!nextViewKey) closeWorkbench();
  }, [closeWorkbench, sideChat?.sourceThreadId, views, externalViewOpen]);
  const requestCloseSideChat = React.useCallback(() => {
    if (!sideChat) return;
    if (sideChatCloseConfirmationDisabled) {
      closeSideChat();
      return;
    }
    setSideChatCloseDialogOpen(true);
  }, [closeSideChat, sideChat, sideChatCloseConfirmationDisabled]);
  const confirmCloseSideChat = React.useCallback(
    (dontAskAgain: boolean) => {
      if (dontAskAgain) {
        persistSideChatCloseConfirmationDisabled(true);
        setSideChatCloseConfirmationDisabled(true);
      }
      closeSideChat();
    },
    [closeSideChat],
  );
  const contextValue = React.useMemo<WorkbenchContextValue>(
    () => ({
      enabled,
      open,
      loading,
      available,
      disabledReason,
      sideChatEnabled,
      askInSideChat,
      externalAssistantsEnabled,
      openExternalAssistant,
      toggle: () => {
        if (!available) return;
        if (open) {
          closeWorkbench();
        } else {
          if (hasExternalRuns && !activeViewKey) {
            setExternalSession({ scope: externalScope, selectedId: null });
            setActiveViewKey(EXTERNAL_ASSISTANTS_VIEW_KEY);
          }
          setOpen(true);
        }
      },
    }),
    [
      askInSideChat,
      externalAssistantsEnabled,
      openExternalAssistant,
      hasExternalRuns,
      activeViewKey,
      externalScope,
      available,
      closeWorkbench,
      disabledReason,
      enabled,
      loading,
      open,
      sideChatEnabled,
      setOpen,
    ],
  );

  const { resizing, startResize } = useWorkbenchResize({
    rootRef, isNarrow, resolvedPanelWidth, open, expanded, setPanelWidth, setExpanded,
  });

  const panel = (
    <WorkbenchPanel
      visible={open}
      views={views}
      activeView={activeView}
      activeViewKey={activeViewKey}
      sideChat={sideChat}
      sideChatOpening={sideChatOpening}
      externalViewOpen={externalViewOpen}
      externalRuns={externalRuns}
      workbenchMessages={workbenchMessages}
      selectedExternalId={
        externalViewOpen ? (externalSession?.selectedId ?? null) : null
      }
      onSelectExternal={(selectedId) =>
        setExternalSession({ scope: externalScope, selectedId })
      }
      onCloseExternal={() => {
        setExternalSession(null);
        const next = sideChat ? SIDE_CHAT_VIEW_KEY : (views[0]?.key ?? null);
        setActiveViewKey(next);
        if (!next) closeWorkbench();
      }}
      options={options}
      stream={stream}
      hostId={stream.assistantId}
      locale={locale}
      hostEvent={hostEvent}
      viewHosts={viewHosts}
      notification={notification}
      error={error}
      loading={loading}
      expanded={expanded}
      onClose={closeWorkbench}
      onRequestCloseSideChat={requestCloseSideChat}
      onToggleExpanded={() => setExpanded((current) => !current)}
      onReload={() => setReloadVersion((version) => version + 1)}
      onSelect={setActiveViewKey}
      onNotify={(level, message) => {
        setNotification({ level, message });
        window.setTimeout(() => {
          setNotification((current) =>
            current?.message === message ? null : current,
          );
        }, 4000);
      }}
      onClientCommand={executeClientCommand}
    />
  );

  return (
    <WorkbenchContext.Provider value={contextValue}>
      <div
        ref={rootRef}
        className="relative flex h-full min-h-0 w-full overflow-hidden bg-background"
        data-chatkit-workbench-root=""
      >
        {resizing && <div aria-hidden="true" className="fixed inset-0 z-[100] cursor-col-resize select-none" />}
        <div
          data-chatkit-chat-panel=""
          hidden={open && expanded}
          className={cn(
            'flex min-w-0 flex-1',
            open && expanded && 'hidden',
          )}
        >
          {children}
        </div>

        {(open || Boolean(sideChat) || externalViewOpen) && !isNarrow && (
          <>
            {open && !expanded && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t('workbench.resize')}
                tabIndex={0}
                aria-valuemin={CHAT_MIN_WIDTH}
                aria-valuemax={Math.max(CHAT_MIN_WIDTH, containerWidth - WORKBENCH_MIN_WIDTH)}
                aria-valuenow={Math.round(containerWidth - resolvedPanelWidth)}
                onPointerDown={startResize}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)) return;
                  event.preventDefault();
                  if (event.key === 'Enter') { setExpanded(true); return; }
                  const width = event.key === 'Home' ? containerWidth - CHAT_MIN_WIDTH
                    : event.key === 'End' ? WORKBENCH_MIN_WIDTH
                    : resolvedPanelWidth + (event.key === 'ArrowLeft' ? 16 : -16);
                  setPanelWidth(clampPanelWidth(width, containerWidth));
                }}
                className="group relative z-20 w-0.5 shrink-0 cursor-col-resize touch-none bg-border outline-none transition-colors hover:bg-primary/50 focus-visible:bg-primary"
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
              </div>
            )}
            <aside
              hidden={!open}
              className={cn(
                'h-full min-h-0 border-l-0 bg-background',
                !open && 'hidden',
                expanded ? 'min-w-0 flex-1' : 'shrink-0',
              )}
              style={expanded ? undefined : { width: resolvedPanelWidth }}
              aria-label={t('workbench.title')}
            >
              {panel}
            </aside>
          </>
        )}

        <Sheet
          open={open && isNarrow}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setOpen(true);
            } else {
              closeWorkbench();
            }
          }}
        >
          <SheetContent
            forceMount={
              isNarrow && (sideChat || externalViewOpen) ? true : undefined
            }
            side="right"
            showCloseButton={false}
            className={cn(
              'flex h-full max-w-none flex-col gap-0 p-0',
              (sideChat || externalViewOpen) && 'data-[state=closed]:hidden',
              expanded
                ? 'inset-0 w-full max-w-none border-0 shadow-none sm:max-w-none'
                : 'w-[min(92vw,720px)]',
            )}
          >
            <SheetTitle className="sr-only">{t('workbench.title')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('workbench.description')}
            </SheetDescription>
            {panel}
          </SheetContent>
        </Sheet>
        <SideChatCloseDialog
          open={sideChatCloseDialogOpen}
          onOpenChange={setSideChatCloseDialogOpen}
          onConfirm={confirmCloseSideChat}
        />
      </div>
    </WorkbenchContext.Provider>
  );
}

export function buildWorkbenchRequestContext(
  contexts: ReadonlyMap<string, WorkbenchAssistantContext>,
): Record<string, unknown> {
  const requestContext: Record<string, unknown> = {};
  const env: Record<string, string> = {};
  for (const [key, value] of contexts.entries()) {
    Object.assign(env, value.env ?? {});
    if (value.context) requestContext[key] = value.context;
  }
  if (Object.keys(env).length > 0) requestContext.env = env;
  return requestContext;
}

function isSupportedWorkbenchView(manifest: XpertExtensionViewManifest) {
  return (
    manifest.visible !== false &&
    manifest.workbench?.fixed !== false &&
    manifest.workbench?.menu?.enabled !== false &&
    manifest.view.type === 'remote_component' &&
    manifest.view.component.isolation === 'iframe'
  );
}

function compareWorkbenchViews(
  left: XpertExtensionViewManifest,
  right: XpertExtensionViewManifest,
) {
  return (
    (left.workbench?.menu?.order ?? left.order ?? 0) -
      (right.workbench?.menu?.order ?? right.order ?? 0) ||
    left.key.localeCompare(right.key)
  );
}
function parseContextSetPayload(payload: unknown): {
  key: string;
  clear: boolean;
  env?: Record<string, string>;
  context?: Record<string, unknown>;
} {
  if (!isObject(payload)) return { key: '', clear: false };
  const key = readString(payload, 'key') ?? '';
  const clear = Reflect.get(payload, 'clear') === true;
  const env = copyStringFields(Reflect.get(payload, 'env'));
  const contextValue = Reflect.get(payload, 'context');
  const context = isObject(contextValue)
    ? Object.fromEntries(Object.entries(contextValue))
    : undefined;
  return {
    key,
    clear,
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(context ? { context } : {}),
  };
}

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: object, key: string) {
  const field = Reflect.get(value, key);
  return typeof field === 'string' && field.trim() ? field.trim() : undefined;
}

function copyStringFields(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'string') result[key] = field;
  }
  return result;
}

function parseChatMessagePayload(payload: unknown) {
  const value = isObject(payload) ? payload : null;
  const references = normalizeReferences(
    value ? Reflect.get(value, 'references') : undefined,
  );
  const referenceCompositionValue = value
    ? Reflect.get(value, 'referenceComposition')
    : undefined;
  const referenceComposition: ChatKitReferenceCompositionMode | undefined =
    referenceCompositionValue === 'compose' ||
    referenceCompositionValue === 'preserve'
      ? referenceCompositionValue
      : undefined;
  const runtimeCapabilitiesValue = value
    ? Reflect.get(value, 'runtimeCapabilities')
    : undefined;
  const followUpModeValue = value
    ? Reflect.get(value, 'followUpMode')
    : undefined;
  const followUpMode: FollowUpBehavior | undefined =
    followUpModeValue === 'queue' || followUpModeValue === 'steer'
      ? followUpModeValue
      : undefined;
  const stateValue = value ? Reflect.get(value, 'state') : undefined;

  return {
    text: value
      ? (readString(value, 'text') ?? readString(value, 'input') ?? '')
      : '',
    files: value
      ? [
          ...parseChatRequestFiles(Reflect.get(value, 'files')),
          ...parseChatAttachments(Reflect.get(value, 'attachments')),
        ]
      : [],
    references,
    referenceComposition,
    followUpMode,
    state: isObject(stateValue)
      ? Object.fromEntries(Object.entries(stateValue))
      : undefined,
    planMode: value ? Reflect.get(value, 'planMode') === true : false,
    newThread: value ? Reflect.get(value, 'newThread') === true : false,
    clientMessageId: value ? readString(value, 'clientMessageId') : undefined,
    runtimeCapabilities: isRuntimeCapabilitiesSelection(
      runtimeCapabilitiesValue,
    )
      ? runtimeCapabilitiesValue
      : undefined,
  };
}

function parseChatAttachments(value: unknown): ChatRequestFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isObject(candidate)) return [];
    const id = readString(candidate, 'id');
    const name =
      readString(candidate, 'name') ?? readString(candidate, 'originalName');
    const mimeType =
      readString(candidate, 'mime_type') ??
      readString(candidate, 'mimeType') ??
      readString(candidate, 'mimetype');
    if (!id) return [];
    return [
      {
        id,
        ...(name ? { name, originalName: name } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(readString(candidate, 'preview_url')
          ? { thumbUrl: readString(candidate, 'preview_url') }
          : {}),
      },
    ];
  });
}

function parseChatRequestFiles(value: unknown): ChatRequestFile[] {
  if (!Array.isArray(value)) return [];
  const files: ChatRequestFile[] = [];
  for (const candidate of value) {
    if (!isObject(candidate)) continue;
    const fileAssetId = readString(candidate, 'fileAssetId');
    const id = readString(candidate, 'id');
    const fileId = readString(candidate, 'fileId');
    const storageFileId = readString(candidate, 'storageFileId');
    const metadata = readChatFileMetadata(candidate);

    if (fileAssetId) {
      files.push({
        fileAssetId,
        ...(fileId ? { fileId } : {}),
        ...(storageFileId ? { storageFileId } : {}),
        ...metadata,
      });
      continue;
    }
    if (id && fileId && storageFileId) {
      files.push({ id, fileId, storageFileId, ...metadata });
      continue;
    }
    if (storageFileId) {
      files.push({ storageFileId, ...metadata });
      continue;
    }
    if (id) {
      files.push({ id, ...metadata });
    }
  }
  return files;
}

function readChatFileMetadata(value: object) {
  const name =
    readString(value, 'name') ??
    readString(value, 'originalName') ??
    readString(value, 'fileName');
  const mimeType =
    readString(value, 'mimeType') ?? readString(value, 'mimetype');
  const url = readString(value, 'url');
  const fileUrl = readString(value, 'fileUrl');
  const thumbUrl =
    readString(value, 'thumbUrl') ?? readString(value, 'previewUrl');
  const sizeValue = Reflect.get(value, 'size');
  return {
    ...(name ? { name, originalName: name } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(url ? { url } : {}),
    ...(fileUrl ? { fileUrl } : {}),
    ...(thumbUrl ? { thumbUrl } : {}),
    ...(typeof sizeValue === 'number' && Number.isFinite(sizeValue)
      ? { size: sizeValue }
      : {}),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return typeof error === 'string' && error.trim() ? error.trim() : fallback;
}
