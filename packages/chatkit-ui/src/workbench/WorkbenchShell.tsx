import { useWorkbenchRuntime, type WorkbenchRuntime } from './WorkbenchRuntime';
import { useGroupExecutionRecord } from './group/useGroupExecutionRecord';
import { ResourceCardContext } from '../resource-cards/context';
import { useWorkbenchResourceCardActions } from './resource-cards/useResourceCardActions';
import type { ResourceCardOpenTarget } from '@xpert-ai/chatkit-types';
import { useMessageFocus } from './useMessageFocus';
import { createFileChangeReview } from './file-review/file-change-review';
import type {
  XpertRemoteViewHostEventMessage,
  XpertViewQuery,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import { useParentMessenger } from '../hooks/useParentMessenger';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { useStreamContext } from '../providers/Stream';
import { parseNavigation } from './client-command-payload';
import type { WorkbenchPreview } from './preview/types';
import type { WorkbenchContextValue } from './context';
import { createHtmlArtifactPreview } from './html-preview/html-artifact-preview';
import {
  collectExternalAssistantRuns,
  EXTERNAL_ASSISTANTS_VIEW_KEY,
  toWorkbenchMessages,
} from './external-assistant/external-assistant-runs';
import {
  CHATKIT_INTERNAL_PARENT_EVENT,
  normalizeChatKitHostEvent,
} from './host-events';
import { workbenchLayoutKey } from './layout-storage';
import { NATIVE_PREFIX, useNativeWorkbench } from './native/useNativeWorkbench';
import { getErrorMessage } from './shell/commands/request-context';
import {
  type WorkbenchAssistantContext,
  type WorkbenchShellProps,
} from './shell/types';
import { isSideChatCloseConfirmationDisabled } from './side-chat/SideChatCloseDialog';
import { useExecutionFocus } from './useExecutionFocus';
import { useInitialLoading } from './useInitialLoading';
import { useLocalExecutionNavigation } from './useLocalExecutionNavigation';
import { useResourceCardNavigation } from './resource-cards/useResourceCardNavigation';
import { useWorkbenchLayout } from './useWorkbenchLayout';
import {
  isWorkbenchNewTab,
  useWorkbenchPages,
} from './useWorkbenchPages';
import { useWorkbenchPanelHost } from './useWorkbenchPanelHost';
import { useWorkbenchResize } from './useWorkbenchResize';
import { useWorkbenchViews } from './useWorkbenchViews';
import { useWorkbenchViewTabs } from './useWorkbenchViewTabs';
import { MAIN_CHAT_VIEW_KEY, WorkbenchPanel } from './WorkbenchPanel';
import { SIDE_CHAT_VIEW_KEY, type SideChatSession } from './side-chat/types';

import { useWorkbenchClientCommands } from './shell/commands/useWorkbenchClientCommands';
import { WorkbenchShellLayout } from './shell/layout/WorkbenchShellLayout';
import { WORKBENCH_NARROW_BREAKPOINT } from './shell/layout/WorkbenchFrame';
import { useWorkbenchSideChat } from './shell/side-chat/useWorkbenchSideChat';
import { useWorkbenchShellTabs } from './shell/tabs/useWorkbenchShellTabs';
export { useWorkbench, WorkbenchToggleButton } from './context';
export { buildWorkbenchRequestContext } from './shell/commands/request-context';
export { type WorkbenchAssistantContext } from './shell/types';

const isNativeView = (key: string | null) =>
  key === MAIN_CHAT_VIEW_KEY ||
  key === SIDE_CHAT_VIEW_KEY ||
  key === EXTERNAL_ASSISTANTS_VIEW_KEY ||
  Boolean(key?.startsWith(NATIVE_PREFIX));
const NARROW_BREAKPOINT = WORKBENCH_NARROW_BREAKPOINT;

export function WorkbenchShell(props: WorkbenchShellProps) {
  const runtime = useWorkbenchRuntime();
  return runtime ? (
    <WorkbenchContent {...props} stream={runtime} />
  ) : (
    <PrivateWorkbenchShell {...props} />
  );
}
function PrivateWorkbenchShell(props: WorkbenchShellProps) {
  return <WorkbenchContent {...props} stream={useStreamContext()} />;
}
function WorkbenchContent({
  options,
  locale,
  children,
  onRequestContextChange,
  onNavigate,
  initialNavigation,
  initializing = false,
  stream,
}: WorkbenchShellProps & { stream: WorkbenchRuntime }) {
  const { t } = useChatkitTranslation();
  const groupRecord = useGroupExecutionRecord(stream.client, stream.group?.id);
  const parentMessenger = useParentMessenger();
  const remoteViewsEnabled = options?.workbench?.enabled === true;
  const sideChatEnabled =
    !stream.group &&
    (options?.workbench?.sideChat?.enabled ?? remoteViewsEnabled);

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

  const hasExternalRuns =
    externalAssistantsEnabled &&
    (externalRuns.length > 0 || !!groupRecord.target);
  const enabled =
    remoteViewsEnabled || sideChatEnabled || hasExternalRuns || !!stream.group;
  const externalScope = `${stream.assistantId}:${stream.threadId ?? stream.conversationId ?? ''}`;
  const [externalSession, setExternalSession] = React.useState<{
    scope: string;
    selectedId: string | null;
  } | null>(null);

  const externalViewOpen =
    externalAssistantsEnabled && externalSession?.scope === externalScope;

  const authenticated = stream.authenticated ?? Boolean(stream.apiKey?.trim());
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

  const startPageScope = JSON.stringify([viewScopeKey, authenticated, enabled]);
  const startPageScopeRef = React.useRef(startPageScope);

  startPageScopeRef.current = startPageScope;

  const native = useNativeWorkbench(startPageScope);
  const {
    previews,
    newTabs,
    recent,
    browserHistory,
    navigateBrowser,
    moveBrowser,
    reset: resetPages,
    clearPreviews,
    addNewTab,
    closeNewTab,
    openPreview: storePreview,
    closePreview: removePreview,
    visitPreview,
  } = useWorkbenchPages(startPageScope);

  const { views, viewsScope, loading, error } = useWorkbenchViews({
    client: viewHosts,
    hostId: stream.assistantId,
    scopeKey: viewScopeKey,
    retentionKey: layoutKey ?? '',
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
          (remoteViewsEnabled &&
            !hasExternalRuns &&
            viewsScope !== viewScopeKey &&
            !error))),
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
    scope: layoutKey ?? '',
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
          (viewsScope === viewScopeKey && (views.length > 0 || !expanded)))));

  const mainChatInWorkbench = open && expanded;
  const openPreview = React.useCallback(
    (preview: WorkbenchPreview) => {
      storePreview(preview);
      setActiveViewKey(preview.key);
      setOpen(true);
    },
    [storePreview, setOpen],
  );

  const selectTab = (key: string) => {
    if (views.some((view) => view.key === key)) selectView(key);
    else setActiveViewKey(key);
    visitPreview(key);
  };

  const { tabKeys, adjacentTab, replaceNewTab, insertTabBefore, createNewTab } =
    useWorkbenchShellTabs({
      native,
      externalViewOpen,
      sideChat,
      sideChatOpening,
      previews,
      scopedViews,
      newTabs,
      startPageScope,
      mainChatInWorkbench,
      activeViewKey,
      setActiveViewKey,
      loading,
      views,
      closeNewTab,
      addNewTab,
      setOpen,
      fallbackReady: open && !initialLoading && !loading && !error,
    });

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
    resetPages();
    setViewQueries({});
    setActiveViewKey((current) =>
      current?.startsWith(NATIVE_PREFIX) ||
      current?.startsWith('chatkit.preview.')
        ? null
        : current,
    );
    setNotification(null);
    setHostEvent(null);
    contextsRef.current.clear();
    onRequestContextChange({});
  }, [
    viewScopeKey,
    authenticated,
    remoteViewsEnabled,
    onRequestContextChange,
    resetPages,
  ]);

  React.useEffect(() => {
    if (views.length === 0) {
      // An empty recommendation list must not erase address-bar navigation.
      const unavailable = viewsScope !== viewScopeKey;
      if (unavailable) clearPreviews();
      setViewQueries({});
      setActiveViewKey((current) =>
        isNativeView(current) ||
        isWorkbenchNewTab(current) ||
        (!unavailable && current?.startsWith('chatkit.preview.'))
          ? current
          : null,
      );
      contextsRef.current.clear();
      onRequestContextChange({});
      return;
    }
    if (viewsScope !== viewScopeKey) return;
    setActiveViewKey((current) =>
      isNativeView(current) ||
      isWorkbenchNewTab(current) ||
      current?.startsWith('chatkit.preview.') ||
      (current && scopedViews.some((view) => view.key === current))
        ? current
        : (scopedViews[0]?.key ?? null),
    );
  }, [
    views,
    scopedViews,
    viewsScope,
    viewScopeKey,
    onRequestContextChange,
    clearPreviews,
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
        const next =
          tabKeys.find((key) => key !== EXTERNAL_ASSISTANTS_VIEW_KEY) ?? null;
        setActiveViewKey(next);
        if (!next) dismiss();
      }
    }
  }, [
    externalAssistantsEnabled,
    externalScope,
    externalSession,
    activeViewKey,
    tabKeys,
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

  const openMessage = useMessageFocus({
    ...executionFocusOptions,
    conversationId: stream.conversationId,
    scope: JSON.stringify([stream.apiUrl, stream.organizationId]),
    unavailableMessage: t('workbench.messageUnavailable'),
    historyError:
      stream.historyLoad?.status === 'error'
        ? getErrorMessage(
            stream.historyLoad.error,
            t('workbench.messageUnavailable'),
          )
        : undefined,
  });

  useParentMessenger({ onFocusMessage: openMessage });

  const rememberResourceCard = useResourceCardNavigation({
    scope: layoutKey ?? '',
    enabled: remoteViewsEnabled && authenticated,
    ready: !loading && viewsScope === viewScopeKey,
    restore: (target) => {
      if (
        target.target !== 'workbench.view' ||
        !views.some((view) => view.key === target.viewKey)
      )
        return false;
      setViewQueries((current) => ({
        ...current,
        [target.viewKey]: {
          selectionId: target.selectionId,
          parameters: target.parameters,
        },
      }));
      selectView(target.viewKey);
      setOpen(true);
      return true;
    },
    close: () => setOpen(false),
  });

  const { executeClientCommand } = useWorkbenchClientCommands({
    onRequestContextChange,
    contextsRef,
    t,
    options,
    stream,
    setNotification,
    views,
    setViewQueries,
    selectView,
    setOpen,
    openPreview,
    setExpanded,
    isNarrow,
    parentMessenger,
    onNavigate,
    openExecution,
    openMessage,
  });

  React.useEffect(() => {
    if (!initialNavigation || loading || viewsScope !== viewScopeKey) return;
    const navigation = parseNavigation(initialNavigation.payload);
    if (
      navigation.target === 'assistant.conversation' &&
      !navigation.preserveView
    ) {
      setExpanded(false);
      setOpen(false);
    }
    const viewKey = navigation.viewKey;
    if (viewKey && views.some((view) => view.key === viewKey)) {
      // A conversation scope change clears old queries. Restore the explicitly
      // requested resource even when keeping its panel open.
      if (!navigation.preserveView || Object.keys(navigation.query).length > 0)
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
    (Boolean(stream.group) && authenticated && stream.runtimeScopeReady) ||
    hasExternalRuns ||
    (enabled &&
      authenticated &&
      Boolean(stream.assistantId.trim()) &&
      (Boolean(sideChat) ||
        (remoteViewsEnabled &&
          viewsScope === viewScopeKey &&
          (!loading || views.length > 0))));

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

  const { askInSideChat, requestCloseSideChat, confirmCloseSideChat } =
    useWorkbenchSideChat({
      sideChatEnabled,
      stream,
      t,
      setActiveViewKey,
      setOpen,
      setSideChatOpening,
      sideThreadBySourceRef,
      setSideChat,
      sideChat,
      setSideChatCloseDialogOpen,
      adjacentTab,
      closeWorkbench,
      sideChatCloseConfirmationDisabled,
      setSideChatCloseConfirmationDisabled,
    });

  const navigateResourceCard = React.useCallback(
    (
      target: ResourceCardOpenTarget,
      origin: { messageId: string; id: string },
    ) =>
      executeClientCommand(
        'workbench.navigation.open',
        target,
        { key: target.viewKey },
        origin,
      ),
    [executeClientCommand],
  );
  const resourceCardActions = useWorkbenchResourceCardActions({
    client: viewHosts,
    assistantId: stream.assistantId,
    runtimeScope,
    available: authenticated && stream.runtimeScopeReady !== false,
    canOpen: enabled,
    openPreview,
    navigate: navigateResourceCard,
    remember: rememberResourceCard,
  });

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
      openGroupAssistant: stream.group
        ? (target) => {
            groupRecord.select(target);
            setExternalSession({ scope: externalScope, selectedId: null });
            setActiveViewKey(EXTERNAL_ASSISTANTS_VIEW_KEY);
            setExpanded(false);
            setOpen(true);
          }
        : undefined,
      openHtmlArtifact: (resource, title) => {
        if (!enabled || !authenticated || !stream.conversationId) return false;
        const conversationId = stream.conversationId;
        openPreview(
          createHtmlArtifactPreview(
            resource,
            title,
            (signal) =>
              stream.client.workbench.downloadArtifact(
                conversationId,
                resource,
                { signal },
              ),
            t('workbench.preview.htmlUnavailable'),
            async (reference) => {
              await parentMessenger.updateComposer({
                appendReferences: true,
                references: [reference],
              });
              setExpanded(false);
              if (isNarrow) setOpen(false);
              await parentMessenger.focusComposer();
            },
          ),
        );
        return true;
      },
      openFileReview: (resource) => {
        if (!enabled || !authenticated || !stream.conversationId) return false;
        openPreview(
          createFileChangeReview(
            stream.client,
            stream.conversationId,
            resource,
            t('fileActivity.review'),
            openPreview,
          ),
        );
        return true;
      },
      openProject: (projectId, viewKey) =>
        executeClientCommand(
          'workbench.navigation.open',
          { target: 'assistant.project', projectId, viewKey },
          { key: viewKey },
        ),
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
      stream.group,
      groupRecord.select,
      executeClientCommand,
      openPreview,
      parentMessenger.updateComposer,
      parentMessenger.focusComposer,
      isNarrow,
      authenticated,
      stream.client,
      stream.conversationId,
      t,
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
  const chatHost = useWorkbenchPanelHost();
  const chat = (
    <div
      data-chatkit-chat-panel=""
      inert={initialLoading}
      aria-hidden={initialLoading || undefined}
      className="flex h-full min-h-0 min-w-0 flex-1"
    >
      {children}
    </div>
  );

  const panel = (
    <WorkbenchPanel
      tabOrder={tabKeys}
      mainChatHost={mainChatInWorkbench ? chatHost.attach : undefined}
      native={native}
      sideChatEnabled={sideChatEnabled}
      onOpenNative={(tool, fromTab) => {
        if (tool === 'side-chat') {
          const nextTab = fromTab
            ? tabKeys
                .slice(tabKeys.indexOf(fromTab) + 1)
                .find((key) => key !== SIDE_CHAT_VIEW_KEY)
            : undefined;
          replaceNewTab(fromTab, SIDE_CHAT_VIEW_KEY);
          void askInSideChat().catch((error: unknown) => {
            if (startPageScopeRef.current !== startPageScope) return;
            if (fromTab) {
              // The pending side-chat tab may already have disappeared after failure.
              insertTabBefore(fromTab, nextTab);
              addNewTab(fromTab);
              setActiveViewKey((current) =>
                current === SIDE_CHAT_VIEW_KEY ? fromTab : current,
              );
            }
            setNotification({
              level: 'error',
              message: getErrorMessage(error, t('workbench.files.failed')),
            });
          });
        } else {
          const key = native.openTool(tool);
          replaceNewTab(fromTab, key);
          setActiveViewKey(key);
          setOpen(true);
        }
      }}
      onOpenNativeFile={(file, fromTab) => {
        const key = native.openFile(file);
        replaceNewTab(fromTab, key);
        setActiveViewKey(key);
        setOpen(true);
      }}
      onCloseNative={(key) => {
        if (native.requestClose(key) && activeViewKey === key) {
          const next = adjacentTab(key);
          setActiveViewKey(next);
          if (!next) closeWorkbench();
        }
      }}
      visible={open}
      previews={previews}
      viewQueries={viewQueries}
      newTabs={newTabs}
      recent={recent}
      browserHistory={browserHistory}
      onNavigateBrowser={navigateBrowser}
      onMoveBrowser={moveBrowser}
      onNewTab={createNewTab}
      onCloseNewTab={(key) => {
        closeNewTab(key);
        if (activeViewKey === key) {
          const next = adjacentTab(key);
          setActiveViewKey(next);
          if (!next) closeWorkbench();
        }
      }}
      onNavigateNewTab={(tabKey, viewKey) => {
        if (!menuViews.some((view) => view.key === viewKey)) return;
        replaceNewTab(tabKey, viewKey);
        selectView(viewKey);
      }}
      onPreviewFromNewTab={(tabKey, preview) => {
        if (preview.kind === 'browser') {
          navigateBrowser(tabKey, preview);
          setActiveViewKey(tabKey);
          setOpen(true);
          return;
        }
        replaceNewTab(tabKey, preview.key);
        openPreview(preview);
      }}
      onClosePreview={(key) => {
        removePreview(key);
        if (activeViewKey === key) {
          const next = adjacentTab(key);
          setActiveViewKey(next);
          if (!next) closeWorkbench();
        }
      }}
      views={scopedViews}
      availableViews={menuViews}
      onCloseView={(key) => {
        closeView(key);
        if (activeViewKey === key) {
          const next = adjacentTab(key);
          setActiveViewKey(next);
          if (!next) closeWorkbench();
        }
      }}
      activeView={activeView}
      activeViewKey={activeViewKey}
      sideChat={sideChat}
      sideChatOpening={sideChatOpening}
      externalViewOpen={externalViewOpen}
      externalRuns={externalRuns}
      groupRecord={stream.group ? groupRecord : undefined}
      workbenchMessages={workbenchMessages}
      selectedExternalId={
        externalViewOpen ? (externalSession?.selectedId ?? null) : null
      }
      onSelectExternal={(selectedId) =>
        setExternalSession({ scope: externalScope, selectedId })
      }
      onCloseExternal={() => {
        groupRecord.select(null);
        setExternalSession(null);
        const next = adjacentTab(EXTERNAL_ASSISTANTS_VIEW_KEY);
        setActiveViewKey(next);
        if (!next) closeWorkbench();
      }}
      options={options}
      stream={stream}
      hostId={stream.assistantId}
      runtimeScope={runtimeScope}
      contextReady={
        stream.runtimeScopeReady !== false && viewsScope === viewScopeKey
      }
      reloadVersion={reloadVersion}
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
      onSelect={selectTab}
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
    <ResourceCardContext.Provider value={resourceCardActions}>
      <WorkbenchShellLayout
        contextValue={contextValue}
        rootRef={rootRef}
        isNarrow={isNarrow}
        workbenchSide={workbenchSide}
        initialLoading={initialLoading}
        t={t}
        notification={notification}
        open={open}
        setNotification={setNotification}
        resizing={resizing}
        mainChatInWorkbench={mainChatInWorkbench}
        chatHost={chatHost}
        chat={chat}
        sideChat={sideChat}
        externalViewOpen={externalViewOpen}
        expanded={expanded}
        containerWidth={containerWidth}
        resolvedPanelWidth={resolvedPanelWidth}
        startResize={startResize}
        setPanelWidth={setPanelWidth}
        setExpanded={setExpanded}
        swapSides={swapSides}
        panelHost={panelHost}
        setOpen={setOpen}
        closeWorkbench={closeWorkbench}
        panel={panel}
        native={native}
        activeViewKey={activeViewKey}
        adjacentTab={adjacentTab}
        setActiveViewKey={setActiveViewKey}
        sideChatCloseDialogOpen={sideChatCloseDialogOpen}
        setSideChatCloseDialogOpen={setSideChatCloseDialogOpen}
        confirmCloseSideChat={confirmCloseSideChat}
      />
    </ResourceCardContext.Provider>
  );
}
