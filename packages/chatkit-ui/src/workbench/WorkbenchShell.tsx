import { useResourceCardNavigation } from './useResourceCardNavigation';
import { useWorkbenchViewTabs } from './useWorkbenchViewTabs';
import { useExecutionFocus } from './useExecutionFocus';
import { useLocalExecutionNavigation } from './useLocalExecutionNavigation';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import {
  ASSISTANT_CHAT_SEND_MESSAGE_COMMAND,
  ASSISTANT_CONTEXT_SET_COMMAND,
  type XpertExtensionViewManifest,
  type XpertViewQuery,
  type XpertRemoteViewHostEventMessage,
  type XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import type {
  ChatKitOptions,
  ChatKitReference,
  ChatKitWorkbenchClientCommandRequest,
} from '@xpert-ai/chatkit-types';
import { useStreamContext } from '../providers/Stream';
import { useParentMessenger } from '../hooks/useParentMessenger';
import { buildInjectedRequestOptions } from '../lib/request-options';
import { buildHumanMessageInputPayload } from '../lib/references';
import {
  parseContextSetPayload,
  parseChatMessagePayload,
} from './message-command-payload';
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
import { useWorkbenchPanelHost } from './useWorkbenchPanelHost';
import { executeWorkbenchCommand, unsupportedCommand } from './client-commands';
import {
  parseNavigation,
  type NavigationSession,
  type WorkbenchPreview,
} from './client-command-payload';
import { useWorkbenchLayout } from './useWorkbenchLayout';
import { useWorkbenchViews } from './useWorkbenchViews';
import { useInitialLoading } from './useInitialLoading';
import { workbenchLayoutKey } from './layout-storage';
import { WorkbenchDivider } from './WorkbenchDivider';

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
  onNavigate?: (
    session: NavigationSession,
    request: ChatKitWorkbenchClientCommandRequest,
  ) => void;
  initialNavigation?: ChatKitWorkbenchClientCommandRequest;
  initializing?: boolean;
};

export function WorkbenchShell({
  options,
  locale,
  children,
  onRequestContextChange,
  onNavigate,
  initialNavigation,
  initializing = false,
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
  const runtimeScope = React.useMemo<XpertViewRuntimeScopeInput>(
    () => ({
      projectId: stream.projectId ?? null,
      conversationId: stream.conversationId ?? null,
    }),
    [stream.projectId, stream.conversationId],
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [activeViewKey, setActiveViewKey] = React.useState<string | null>(null);
  const [previews, setPreviews] = React.useState<WorkbenchPreview[]>([]);
  const [viewQueries, setViewQueries] = React.useState<
    Record<string, XpertViewQuery>
  >({});
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
    stream.apiUrl,
    stream.organizationId,
    stream.assistantId,
  );
  const viewScopeKey = JSON.stringify([
    layoutKey,
    runtimeScope.projectId,
    runtimeScope.conversationId,
  ]);
  const { views, viewsScope, loading, error } = useWorkbenchViews({
    client: viewHosts,
    hostId: stream.assistantId,
    scopeKey: viewScopeKey,
    runtimeScope,
    enabled:
      remoteViewsEnabled && authenticated && Boolean(stream.assistantId.trim()),
    ready: stream.runtimeScopeReady !== false,
    locale,
    revision: reloadVersion,
  });
  const menuViews = React.useMemo(
    () => views.filter((view) => view.workbench?.menu?.enabled !== false),
    [views],
  );
  const initialLoading = useInitialLoading(
    layoutKey,
    initializing ||
      (authenticated &&
        Boolean(stream.assistantId.trim()) &&
        stream.historyLoad?.status !== 'error' &&
        (stream.runtimeScopeReady === false ||
          (remoteViewsEnabled && !hasExternalRuns && viewsScope !== viewScopeKey && !error))),
  );
  const {
    requestedOpen,
    expanded,
    restoring,
    resolvedPanelWidth,
    workbenchSide,
    swapSides,
    setOpen,
    setExpanded,
    setPanelWidth,
    dismiss,
  } = useWorkbenchLayout(layoutKey, containerWidth, isNarrow);
  const { scopedViews, selectView, closeView } = useWorkbenchViewTabs({
    views,
    scope: viewScopeKey,
    enabled: remoteViewsEnabled && authenticated,
    projectId: stream.projectId,
    conversationId: stream.conversationId,
    ready: !loading && viewsScope === viewScopeKey,
    onSelect: setActiveViewKey,
    onOpen: setOpen,
    setQueries: setViewQueries,
  });
  const open =
    requestedOpen &&
    enabled &&
    authenticated &&
    (!restoring ||
      (containerWidth >= NARROW_BREAKPOINT &&
        (externalViewOpen ||
          Boolean(sideChat) ||
          (viewsScope === viewScopeKey && views.length > 0))));

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
    setPreviews([]);
    setViewQueries({});
    setActiveViewKey((current) => (isNativeView(current) ? current : null));
    setNotification(null);
    setHostEvent(null);
    contextsRef.current.clear();
    onRequestContextChange({});
  }, [viewScopeKey, authenticated, remoteViewsEnabled, onRequestContextChange]);

  React.useEffect(() => {
    if (views.length === 0) {
      setPreviews([]);
      setViewQueries({});
      setActiveViewKey((current) => (isNativeView(current) ? current : null));
      contextsRef.current.clear();
      onRequestContextChange({});
      return;
    }
    if (viewsScope !== viewScopeKey) return;
    setActiveViewKey((current) =>
      isNativeView(current) || (current && views.some((view) => view.key === current))
        ? current
        : (scopedViews[0]?.key ?? null),
    );
  }, [views, scopedViews, viewsScope, viewScopeKey, onRequestContextChange]);

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
          sideChat ? SIDE_CHAT_VIEW_KEY : (scopedViews[0]?.key ?? null),
        );
        if (!sideChat && !scopedViews.length) {
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
    scopedViews,
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
    scopedViews.find((view) => view.key === activeViewKey) ??
    scopedViews[0] ??
    null;

  const executionFocusOptions = {
    threadId: stream.threadId,
    scope: JSON.stringify([
      stream.apiUrl,
      stream.organizationId,
      externalScope,
    ]),
    externalRuns: externalAssistantsEnabled ? externalRuns : [],
    messages: workbenchMessages,
    history: stream.historyMessagePagination,
    historyReady:
      stream.historyLoad?.threadId === stream.threadId &&
      stream.historyLoad?.status === 'loaded',
    loadMore: stream.loadMoreConversationMessages,
    openExternal: openExternalAssistant,
    rootRef,
    unavailableMessage: t('workbench.executionUnavailable'),
    revealMessage: () => {
      setExpanded(false);
      if (isNarrow) setOpen(false);
    },
  };
  useExecutionFocus({
    ...executionFocusOptions,
    executionId: options?.request?.context?.env?.executionId,
    requestId: options?.request?.context?.env?.executionFocusRequestId,
    requestedThread: options?.request?.context?.env?.threadId,
    onError: (message) => setNotification({ level: 'error', message }),
  });
  const openExecution = useLocalExecutionNavigation({
    ...executionFocusOptions,
    conversationId: stream.conversationId,
    projectId: stream.projectId,
    navigationKey: JSON.stringify([
      options?.request?.context?.env?.executionId,
      options?.request?.context?.env?.executionFocusRequestId,
      options?.request?.context?.env?.threadId,
    ]),
    historyError:
      stream.historyLoad?.status === 'error'
        ? getErrorMessage(
            stream.historyLoad.error,
            t('workbench.executionUnavailable'),
          )
        : undefined,
  });

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
              : (reference.type === 'thread'
                  ? reference.label || reference.threadId
                  : reference.text
                )
                  .trim()
                  .slice(0, 32) || t('workbench.sideChat.title'),
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

  const rememberResourceCard = useResourceCardNavigation({
    scope: viewScopeKey,
    enabled: remoteViewsEnabled && authenticated,
    ready: !loading && viewsScope === viewScopeKey,
    restore: (target) => {
      if (target.target !== 'workbench.view' || !views.some((view) => view.key === target.viewKey)) return false;
      setViewQueries((current) => ({ ...current, [target.viewKey]: {
        selectionId: target.selectionId, parameters: target.parameters,
      } }));
      selectView(target.viewKey);
      setOpen(true);
      return true;
    },
    close: () => setOpen(false),
  });

  const executeClientCommand = React.useCallback(
    async (
      commandKey: string,
      payload: unknown,
      manifest: Pick<XpertExtensionViewManifest, 'key'>,
      resourceCard?: { messageId: string; id: string },
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
        if (message.newThread) stream.reset(null);
        const followUpMode =
          stream.isLoading && !message.newThread
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
          status: followUpMode === 'queue' ? 'queued' : 'sent',
          ...(message.clientMessageId
            ? { clientMessageId: message.clientMessageId }
            : {}),
          ...(!message.newThread && stream.threadId
            ? { threadId: stream.threadId }
            : {}),
        };
      }

      const request = {
        ...(resourceCard ? { resourceCard } : {}),
        commandKey,
        payload,
        hostType: 'agent' as const,
        hostId: stream.assistantId,
        viewKey: manifest.key,
      };
      return executeWorkbenchCommand(request, {
        apiUrl: stream.apiUrl,
        openView: (key, query) => {
          if (!views.some((view) => view.key === key)) return false;
          setViewQueries((current) => ({ ...current, [key]: query }));
          selectView(key);
          setOpen(true);
          return true;
        },
        openPreview: (preview) => {
          setPreviews((current) => [
            ...current.filter((item) => item.key !== preview.key),
            preview,
          ]);
          setActiveViewKey(preview.key);
          setOpen(true);
        },
        revealChat: () => {
          setExpanded(false);
          if (isNarrow) setOpen(false);
        },
        updateComposer: parentMessenger.updateComposer,
        focusComposer: async () => {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          await parentMessenger.focusComposer();
        },
        navigate: onNavigate,
        openExecution,
        forward: async (request) => {
          const onClientCommand = options?.workbench?.onClientCommand;
          if (typeof onClientCommand === 'function')
            return onClientCommand(request);
          if (parentMessenger.isParentAvailable)
            return parentMessenger.sendCommand(
              'onWorkbenchClientCommand',
              request,
            );
          return unsupportedCommand(request.commandKey);
        },
      });
    },
    [
      options?.request,
      views,
      selectView,
      setOpen,
      setExpanded,
      isNarrow,
      onNavigate,
      openExecution,
      options?.workbench?.onClientCommand,
      parentMessenger,
      publishContexts,
      stream,
      t,
    ],
  );

  React.useEffect(() => {
    if (!initialNavigation || loading || viewsScope !== viewScopeKey) return;
    const navigation = parseNavigation(initialNavigation.payload);
    if (navigation.target === 'assistant.conversation') {
      setExpanded(false);
      setOpen(false);
    }
    const viewKey = navigation.viewKey;
    if (viewKey && views.some((view) => view.key === viewKey)) {
      setViewQueries((current) => ({
        ...current,
        [viewKey]: navigation.query,
      }));
      selectView(viewKey);
      setOpen(true);
    }
  }, [
    initialNavigation,
    loading,
    viewsScope,
    viewScopeKey,
    views,
    selectView,
    setOpen,
    setExpanded,
  ]);

  const available =
    hasExternalRuns ||
    (enabled &&
      authenticated &&
      Boolean(stream.assistantId.trim()) &&
      (Boolean(sideChat) || (remoteViewsEnabled && (!loading || views.length > 0))));
  const disabledReason = hasExternalRuns
    ? undefined
    : !stream.assistantId.trim()
      ? t('workbench.missingAssistant')
      : !authenticated
        ? t('workbench.loading')
        : loading && views.length === 0
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
      : (scopedViews[0]?.key ?? null);
    setActiveViewKey(nextViewKey);
    if (!nextViewKey) closeWorkbench();
  }, [closeWorkbench, sideChat?.sourceThreadId, scopedViews, externalViewOpen]);
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
      viewMenu: {
        views: menuViews,
        locale,
        onSelect: (key) => {
          if (!available || !menuViews.some((view) => view.key === key)) return;
          selectView(key);
          setExpanded(false);
          setOpen(true);
        },
      },
      sideChatEnabled,
      askInSideChat,
      externalAssistantsEnabled,
      openExternalAssistant,
      openResourceCard: async (card, messageId) => {
        const result = await executeClientCommand('workbench.navigation.open', card.data.open,
          { key: card.data.open.viewKey }, { messageId, id: card.id });
        if (result && typeof result === 'object' && 'success' in result && result.success === true)
          rememberResourceCard(card.data.open);
        return result;
      },
      toggle: () => {
        if (!available) return;
        if (open) {
          closeWorkbench();
        } else {
          if (hasExternalRuns && !activeViewKey) {
            setExternalSession({ scope: externalScope, selectedId: null });
            setActiveViewKey(EXTERNAL_ASSISTANTS_VIEW_KEY);
          } else if (!activeViewKey && menuViews[0]) {
            selectView(menuViews[0].key);
          }
          setOpen(true);
        }
      },
    }),
    [
      executeClientCommand,
      rememberResourceCard,
      askInSideChat,
      externalAssistantsEnabled,
      openExternalAssistant,
      hasExternalRuns,
      activeViewKey,
      menuViews,
      selectView,
      locale,
      setExpanded,
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
    rootRef,
    isNarrow,
    resolvedPanelWidth,
    open,
    expanded,
    workbenchSide,
    setPanelWidth,
    setExpanded,
  });

  const panelHost = useWorkbenchPanelHost();
  const panel = (
    <WorkbenchPanel
      visible={open}
      previews={previews}
      viewQueries={viewQueries}
      onClosePreview={(key) => {
        setPreviews((current) => current.filter((item) => item.key !== key));
        if (activeViewKey === key) setActiveViewKey(scopedViews[0]?.key ?? null);
      }}
      views={scopedViews}
      availableViews={menuViews}
      onCloseView={(key) => {
        if (closeView(key)) closeWorkbench();
      }}
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
        const next = sideChat ? SIDE_CHAT_VIEW_KEY : (scopedViews[0]?.key ?? null);
        setActiveViewKey(next);
        if (!next) closeWorkbench();
      }}
      options={options}
      stream={stream}
      hostId={stream.assistantId}
      runtimeScope={runtimeScope}
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
      onSelect={selectView}
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
        className={cn(
          'relative flex h-full min-h-0 w-full overflow-hidden bg-background',
          !isNarrow && workbenchSide === 'left' && 'flex-row-reverse',
        )}
        data-workbench-side={workbenchSide}
        data-chatkit-workbench-root=""
        aria-busy={initialLoading}
      >
        {initialLoading && (
          <div
            role="status"
            className="absolute inset-0 z-50 flex items-center justify-center gap-2 bg-background text-sm text-muted-foreground"
          >
            <Loader2 size={16} className="animate-spin" />
            {t('message.loading')}
          </div>
        )}
        {notification && !open && (
          <div
            role="alert"
            className="absolute inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-3 text-sm shadow-lg"
          >
            <span className="flex-1">{notification.message}</span>
            <button
              type="button"
              aria-label={t('workbench.close')}
              className="rounded px-2 hover:bg-muted"
              onClick={() => setNotification(null)}
            >
              ×
            </button>
          </div>
        )}
        {resizing && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[100] cursor-col-resize select-none"
          />
        )}
        <div
          data-chatkit-chat-panel=""
          hidden={open && expanded}
          inert={initialLoading}
          aria-hidden={initialLoading || undefined}
          className={cn('flex min-w-0 flex-1', open && expanded && 'hidden')}
        >
          {children}
        </div>

        {(open || Boolean(sideChat) || externalViewOpen) && !isNarrow && (
          <>
            {open && !expanded && (
              <WorkbenchDivider
                containerWidth={containerWidth}
                panelWidth={resolvedPanelWidth}
                workbenchSide={workbenchSide}
                resizing={resizing}
                onResizeStart={startResize}
                onPanelWidthChange={setPanelWidth}
                onExpand={() => setExpanded(true)}
                onSwap={swapSides}
              />
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
              <div ref={panelHost.attach} className="contents" />
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
            side="right"
            showCloseButton={false}
            className={cn(
              'flex h-full max-w-none flex-col gap-0 p-0',
              expanded
                ? 'inset-0 w-full max-w-none border-0 shadow-none sm:max-w-none'
                : 'w-[min(92vw,720px)]',
            )}
          >
            <SheetTitle className="sr-only">{t('workbench.title')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('workbench.description')}
            </SheetDescription>
            <div ref={panelHost.attach} className="contents" />
          </SheetContent>
        </Sheet>
        {panelHost.container &&
          (open || Boolean(sideChat) || externalViewOpen) &&
          createPortal(panel, panelHost.container)}
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return typeof error === 'string' && error.trim() ? error.trim() : fallback;
}
