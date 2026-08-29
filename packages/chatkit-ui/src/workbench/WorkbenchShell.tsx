import * as React from 'react';
import {
  ASSISTANT_CHAT_SEND_MESSAGE_COMMAND,
  ASSISTANT_CONTEXT_SET_COMMAND,
  type Client,
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
import {
  Loader2,
  Maximize2,
  Minimize2,
  PanelRight,
  RotateCcw,
  X,
  MessageSquarePlus,
} from 'lucide-react';
import { useStreamContext } from '../providers/Stream';
import { StreamProvider } from '../providers/Stream';
import { Chat, type ChatReferenceRequest } from '../components/chat';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { IconDefinitionRenderer } from '../components/ui/icon-definition';
import { RemoteViewFrame, type RemoteViewHostsClient } from './RemoteViewFrame';
import {
  CHATKIT_INTERNAL_PARENT_EVENT,
  normalizeChatKitHostEvent,
} from './host-events';
import { WorkbenchContext, type WorkbenchContextValue } from './context';
import {
  isSideChatCloseConfirmationDisabled,
  persistSideChatCloseConfirmationDisabled,
  SideChatCloseDialog,
} from './SideChatCloseDialog';

export { useWorkbench, WorkbenchToggleButton } from './context';

const WORKBENCH_SLOT = 'agent.workbench.fixed';
const SIDE_CHAT_VIEW_KEY = 'chatkit.native.side-chat';
const NARROW_BREAKPOINT = 960;
const CHAT_MIN_WIDTH = 384;
const WORKBENCH_MIN_WIDTH = 480;
type WorkbenchViewHostsClient = Pick<Client['viewHosts'], 'listSlotViews'> &
  RemoteViewHostsClient;

export type WorkbenchAssistantContext = {
  env?: Record<string, string>;
  context?: Record<string, unknown>;
};

type SideChatSession = {
  sourceThreadId: string;
  threadId: string;
  title: string;
  referenceRequest: ChatReferenceRequest;
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
  const enabled = remoteViewsEnabled || sideChatEnabled;
  const authenticated = Boolean(stream.apiKey.trim());
  const viewHosts = stream.client.viewHosts;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [views, setViews] = React.useState<XpertExtensionViewManifest[]>([]);
  const [activeViewKey, setActiveViewKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = React.useState(0);
  const [panelWidth, setPanelWidth] = React.useState<number | null>(null);
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
  const previousNarrowRef = React.useRef<boolean | null>(null);

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
    if (previousNarrowRef.current === null) {
      previousNarrowRef.current = isNarrow;
      return;
    }
    if (previousNarrowRef.current !== isNarrow) {
      setOpen(false);
      setExpanded(false);
    }
    previousNarrowRef.current = isNarrow;
  }, [isNarrow]);

  React.useEffect(() => {
    if (!remoteViewsEnabled || !authenticated || !stream.assistantId.trim()) {
      setViews([]);
      setError(null);
      setLoading(false);
      if (!enabled) {
        setActiveViewKey(null);
        setOpen(false);
        setExpanded(false);
      }
      contextsRef.current.clear();
      onRequestContextChange({});
      return;
    }

    const controller = new AbortController();
    setViews([]);
    setActiveViewKey((current) =>
      current === SIDE_CHAT_VIEW_KEY ? current : null,
    );
    setLoading(true);
    setError(null);
    setOpen(false);
    setExpanded(false);
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
        setActiveViewKey((current) =>
          current === SIDE_CHAT_VIEW_KEY ||
          (current && supported.some((view) => view.key === current))
            ? current
            : (supported[0]?.key ?? null),
        );
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setViews([]);
        setActiveViewKey((current) =>
          current === SIDE_CHAT_VIEW_KEY ? current : null,
        );
        setError(getErrorMessage(loadError, t('workbench.loadFailed')));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [
    enabled,
    remoteViewsEnabled,
    authenticated,
    locale,
    onRequestContextChange,
    reloadVersion,
    stream.assistantId,
    t,
    viewHosts,
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
              : reference.text.trim().slice(0, 32) ||
                t('workbench.sideChat.title'),
          referenceRequest: {
            id: `${Date.now()}-${reference.text.slice(0, 24)}`,
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
    [sideChatEnabled, stream.client.threads, stream.threadId, t],
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
    enabled &&
    authenticated &&
    Boolean(stream.assistantId.trim()) &&
    (Boolean(sideChat) || (remoteViewsEnabled && !loading));
  const disabledReason = !stream.assistantId.trim()
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
  }, []);
  const closeSideChat = React.useCallback(() => {
    if (sideChat?.sourceThreadId) {
      sideThreadBySourceRef.current.delete(sideChat.sourceThreadId);
    }
    setSideChat(null);
    setSideChatOpening(false);
    setSideChatCloseDialogOpen(false);
    const nextViewKey = views[0]?.key ?? null;
    setActiveViewKey(nextViewKey);
    if (!nextViewKey) closeWorkbench();
  }, [closeWorkbench, sideChat?.sourceThreadId, views]);
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
      toggle: () => {
        if (!available) return;
        if (open) {
          closeWorkbench();
        } else {
          setOpen(true);
        }
      },
    }),
    [
      askInSideChat,
      available,
      closeWorkbench,
      disabledReason,
      enabled,
      loading,
      open,
      sideChatEnabled,
    ],
  );

  const resolvedPanelWidth = clampPanelWidth(
    panelWidth ?? containerWidth * 0.55,
    containerWidth,
  );

  const startResize = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isNarrow) return;
      event.preventDefault();
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();

      const handleMove = (moveEvent: PointerEvent) => {
        setPanelWidth(
          clampPanelWidth(rect.right - moveEvent.clientX, rect.width),
        );
      };
      const stop = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    },
    [isNarrow],
  );

  const panel = (
    <WorkbenchPanel
      views={views}
      activeView={activeView}
      activeViewKey={activeViewKey}
      sideChat={sideChat}
      sideChatOpening={sideChatOpening}
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
        <div
          hidden={open && expanded && !isNarrow}
          className={cn(
            'flex min-w-0 flex-1',
            open && expanded && !isNarrow && 'hidden',
          )}
        >
          {children}
        </div>

        {(open || Boolean(sideChat)) && !isNarrow && (
          <>
            {open && !expanded && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t('workbench.resize')}
                onPointerDown={startResize}
                className="group relative z-20 w-0.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50"
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
            forceMount={isNarrow && sideChat ? true : undefined}
            side="right"
            showCloseButton={false}
            className={cn(
              'flex h-full max-w-none flex-col gap-0 p-0',
              sideChat && 'data-[state=closed]:hidden',
              expanded ? 'w-screen' : 'w-[min(92vw,720px)]',
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

type WorkbenchPanelProps = {
  views: XpertExtensionViewManifest[];
  activeView: XpertExtensionViewManifest | null;
  activeViewKey: string | null;
  sideChat: SideChatSession | null;
  sideChatOpening: boolean;
  options?: ChatKitOptions | null;
  stream: ReturnType<typeof useStreamContext>;
  hostId: string;
  locale: string;
  hostEvent: XpertRemoteViewHostEventMessage | null;
  viewHosts: WorkbenchViewHostsClient;
  notification: { level: 'success' | 'error'; message: string } | null;
  error: string | null;
  loading: boolean;
  expanded: boolean;
  onClose: () => void;
  onRequestCloseSideChat: () => void;
  onToggleExpanded: () => void;
  onReload: () => void;
  onSelect: (viewKey: string) => void;
  onNotify: (level: 'success' | 'error', message: string) => void;
  onClientCommand: (
    commandKey: string,
    payload: unknown,
    manifest: XpertExtensionViewManifest,
  ) => Promise<unknown>;
};

function WorkbenchPanel({
  views,
  activeView,
  activeViewKey,
  sideChat,
  sideChatOpening,
  options,
  stream,
  hostId,
  locale,
  hostEvent,
  viewHosts,
  notification,
  error,
  loading,
  expanded,
  onClose,
  onRequestCloseSideChat,
  onToggleExpanded,
  onReload,
  onSelect,
  onNotify,
  onClientCommand,
}: WorkbenchPanelProps) {
  const { t } = useChatkitTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-2.5">
        {views.length > 0 || sideChat || sideChatOpening ? (
          <div
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
            role="tablist"
            aria-label={t('workbench.views')}
          >
            {(sideChat || sideChatOpening) && (
              <div
                className={cn(
                  'flex h-10 max-w-64 shrink-0 items-center rounded-xl transition-colors',
                  activeViewKey === SIDE_CHAT_VIEW_KEY
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeViewKey === SIDE_CHAT_VIEW_KEY}
                  onClick={() => onSelect(SIDE_CHAT_VIEW_KEY)}
                  className="flex h-full min-w-0 items-center gap-2 px-3 text-sm font-medium"
                >
                  <MessageSquarePlus size={17} className="shrink-0" />
                  <span className="truncate">
                    {sideChat?.title ?? t('workbench.sideChat.title')}
                  </span>
                </button>
                {sideChat && activeViewKey === SIDE_CHAT_VIEW_KEY && (
                  <button
                    type="button"
                    onClick={onRequestCloseSideChat}
                    className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                    aria-label={`${t('workbench.close')}: ${t('workbench.sideChat.title')}`}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            )}
            {views.map((view) => {
              const selected = view.key === activeViewKey;
              const label = resolveManifestText(
                view.workbench?.menu?.label ?? view.title,
                view.key,
                locale,
              );
              return (
                <div
                  key={view.key}
                  className={cn(
                    'flex h-10 max-w-64 shrink-0 items-center rounded-xl transition-colors',
                    selected
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    title={label}
                    onClick={() => onSelect(view.key)}
                    className="flex h-full min-w-0 items-center gap-2 px-3 text-sm font-medium"
                  >
                    <IconDefinitionRenderer
                      icon={view.workbench?.menu?.icon ?? view.icon}
                      size={17}
                      className="text-muted-foreground"
                      fallback={
                        <PanelRight
                          size={17}
                          className="shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      }
                    />
                    <span className="truncate">{label}</span>
                  </button>
                  {selected && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                      aria-label={`${t('workbench.close')}: ${label}`}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleExpanded}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                  'hover:bg-muted hover:text-foreground',
                  expanded && 'bg-muted text-foreground',
                )}
                aria-label={
                  expanded
                    ? t('workbench.restorePanel')
                    : t('workbench.expandPanel')
                }
                aria-pressed={expanded}
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {expanded
                ? t('workbench.restorePanel')
                : t('workbench.expandPanel')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground transition-colors hover:bg-muted/80"
                aria-label={t('workbench.toggleSidebar')}
                aria-pressed={true}
              >
                <PanelRight size={17} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('workbench.toggleSidebar')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {notification && (
        <div
          className={cn(
            'mx-3 mt-3 rounded-lg border px-3 py-2 text-sm',
            notification.level === 'error'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-primary/20 bg-primary/10 text-foreground',
          )}
          role="status"
        >
          {notification.message}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {sideChat && (
          <div
            hidden={activeViewKey !== SIDE_CHAT_VIEW_KEY}
            className="h-full min-h-0"
          >
            <SideChatView
              session={sideChat}
              options={options}
              stream={stream}
            />
          </div>
        )}
        {activeViewKey === SIDE_CHAT_VIEW_KEY ? (
          !sideChat && sideChatOpening ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              {t('workbench.loading')}
            </div>
          ) : null
        ) : loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            {t('workbench.loading')}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={onReload}
              className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
            >
              <RotateCcw size={15} />
              {t('workbench.retry')}
            </button>
          </div>
        ) : activeView ? (
          <RemoteViewFrame
            key={activeView.key}
            manifest={activeView}
            hostId={hostId}
            locale={locale}
            title={resolveManifestText(
              activeView.title,
              activeView.key,
              locale,
            )}
            hostEvent={hostEvent}
            viewHosts={viewHosts}
            onNotify={onNotify}
            onClientCommand={onClientCommand}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {t('workbench.empty')}
          </div>
        )}
      </div>
    </div>
  );
}

function SideChatView({
  session,
  options,
  stream,
}: {
  session: SideChatSession;
  options?: ChatKitOptions | null;
  stream: ReturnType<typeof useStreamContext>;
}) {
  const sideChatOptions = React.useMemo<ChatKitOptions | null>(() => {
    if (!options) return null;
    return {
      ...options,
      initialThread: session.threadId,
      header: { ...options.header, enabled: false },
      history: { ...options.history, enabled: false },
      taskSummary: { ...options.taskSummary, enabled: false },
      workbench: {
        ...options.workbench,
        enabled: false,
        sideChat: { enabled: false },
      },
      pet: false,
    };
  }, [options, session.threadId]);

  return (
    <StreamProvider
      apiKey={stream.apiKey}
      organizationId={stream.organizationId}
      apiUrl={stream.apiUrl}
      xpertId={stream.assistantId}
      projectId={stream.projectId}
      initialThread={session.threadId}
      threadStateMode="memory"
      hostIntegration={false}
    >
      <Chat
        className="h-full"
        clientSecret={stream.apiKey}
        options={sideChatOptions}
        surface="side"
        referenceRequest={session.referenceRequest}
      />
    </StreamProvider>
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

function clampPanelWidth(value: number, containerWidth: number) {
  const max = Math.max(WORKBENCH_MIN_WIDTH, containerWidth - CHAT_MIN_WIDTH);
  return Math.min(max, Math.max(WORKBENCH_MIN_WIDTH, Math.round(value)));
}

function resolveManifestText(
  value: string | { en_US: string; zh_Hans?: string } | undefined,
  fallback: string,
  locale: string,
) {
  if (typeof value === 'string') return value.trim() || fallback;
  if (!value) return fallback;
  const simplifiedChinese =
    locale === 'zh-CN' || locale === 'zh-Hans' || locale === 'zh';
  return (
    (simplifiedChinese ? value.zh_Hans : value.en_US)?.trim() ||
    value.en_US.trim() ||
    value.zh_Hans?.trim() ||
    fallback
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
