import {
  NativeWorkbenchContent,
  NativeWorkbenchTabs,
} from './native/NativeWorkbenchViews';
import type {
  NativeTool,
  useNativeWorkbench,
} from './native/useNativeWorkbench';
import type {
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import { WorkbenchStartPage } from './WorkbenchStartPage';
import type { RecentWorkbenchPreview } from './useWorkbenchPages';
import { useTheme } from '../providers/Theme';
import { getSurfaceThemeStyle } from '../lib/theme-surfaces';
import * as React from 'react';
import type { WorkbenchPreview } from './client-command-payload';
import {
  PreviewTabs,
  WorkbenchPreviewContent,
  WorkbenchBrowserPreview,
} from './WorkbenchPreview';
import type { WorkbenchBrowserHistory } from './useWorkbenchPages';
import type {
  Client,
  XpertViewQuery,
  XpertExtensionViewManifest,
  XpertRemoteViewHostEventMessage,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { StreamProvider, useStreamContext } from '../providers/Stream';
import { Chat, type ChatReferenceRequest } from '../components/chat';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { cn } from '../lib/utils';
import { WorkbenchContext, disabledWorkbenchContext } from './context';
import { ExternalAssistantView } from './ExternalAssistantView';
import {
  EXTERNAL_ASSISTANTS_VIEW_KEY,
  type ExternalAssistantRun,
  type toWorkbenchMessages,
} from './external-assistant-runs';
import {
  Loader2,
  Maximize2,
  Minimize2,
  PanelRight,
  RotateCcw,
  MessageSquarePlus,
  MessageSquare,
  Bot,
  Globe,
  Plus,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { IconDefinitionRenderer } from '../components/ui/icon-definition';
import { RemoteViewFrame, type RemoteViewHostsClient } from './RemoteViewFrame';
import { WorkbenchTabs } from './WorkbenchTabs';
import { WorkbenchTab } from './WorkbenchTab';
import { resolveManifestText } from './manifest-text';

export const SIDE_CHAT_VIEW_KEY = 'chatkit.native.side-chat';
export const MAIN_CHAT_VIEW_KEY = 'chatkit.native.main-chat';

export type SideChatSession = {
  sourceThreadId: string;
  threadId: string;
  title: string;
  referenceRequest?: ChatReferenceRequest;
};

type WorkbenchViewHostsClient = Pick<Client['viewHosts'], 'listSlotViews'> &
  RemoteViewHostsClient;

type WorkbenchPanelProps = {
  tabOrder?: string[];
  mainChatHost?: React.Ref<HTMLDivElement>;
  browserHistory?: Record<string, WorkbenchBrowserHistory>;
  onNavigateBrowser?: (key: string, preview: WorkbenchPreview | null) => void;
  onMoveBrowser?: (key: string, delta: number) => void;
  native?: ReturnType<typeof useNativeWorkbench>;
  onOpenNative?: (tool: NativeTool, fromTab?: string) => void;
  onOpenNativeFile?: (file: XpertWorkspaceFile, fromTab?: string) => void;
  onCloseNative?: (key: string) => void;
  sideChatEnabled?: boolean;
  previews: WorkbenchPreview[];
  newTabs: string[];
  recent: RecentWorkbenchPreview[];
  onNewTab: () => void;
  onCloseNewTab: (key: string) => void;
  onNavigateNewTab: (tabKey: string, viewKey: string) => void;
  onPreviewFromNewTab: (tabKey: string, preview: WorkbenchPreview) => void;
  viewQueries: Record<string, XpertViewQuery>;
  onClosePreview: (key: string) => void;
  visible: boolean;
  views: XpertExtensionViewManifest[];
  availableViews?: XpertExtensionViewManifest[];
  onCloseView?: (key: string) => void;
  activeView: XpertExtensionViewManifest | null;
  activeViewKey: string | null;
  sideChat: SideChatSession | null;
  sideChatOpening: boolean;
  externalViewOpen: boolean;
  externalRuns: ExternalAssistantRun[];
  workbenchMessages: ReturnType<typeof toWorkbenchMessages>;
  selectedExternalId: string | null;
  onSelectExternal: (id: string | null) => void;
  onCloseExternal: () => void;
  options?: ChatKitOptions | null;
  stream: ReturnType<typeof useStreamContext>;
  hostId: string;
  runtimeScope: XpertViewRuntimeScopeInput;
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

export function WorkbenchPanel({
  tabOrder,
  mainChatHost,
  browserHistory = {},
  onNavigateBrowser,
  onMoveBrowser,
  native,
  onOpenNative,
  onOpenNativeFile,
  onCloseNative,
  sideChatEnabled,
  visible,
  previews,
  newTabs,
  recent,
  onNewTab,
  onCloseNewTab,
  onNavigateNewTab,
  onPreviewFromNewTab,
  viewQueries,
  onClosePreview,
  views,
  availableViews = views,
  onCloseView,
  activeView,
  activeViewKey,
  sideChat,
  sideChatOpening,
  externalViewOpen,
  externalRuns,
  workbenchMessages,
  selectedExternalId,
  onSelectExternal,
  onCloseExternal,
  options,
  stream,
  hostId,
  runtimeScope,
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
  const [fileRevision, refreshFiles] = React.useReducer(
    (value) => value + 1,
    0,
  );
  const fileScope = React.useMemo<WorkspaceFileScope | null>(
    () =>
      stream.projectId
        ? stream.conversationId
          ? { kind: 'conversation', conversationId: stream.conversationId }
          : null
        : stream.assistantId
          ? { kind: 'assistant', assistantId: stream.assistantId }
          : null,
    [stream.projectId, stream.conversationId, stream.assistantId],
  );
  const { theme } = useTheme();
  const externalTabId = React.useId();
  const mainChatTabId = React.useId();
  const frameScope = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    hostId,
    runtimeScope.projectId,
    runtimeScope.conversationId,
  ]);
  const [visited, setVisited] = React.useState<{
    scope: string;
    keys: string[];
  }>({
    scope: frameScope,
    keys: [],
  });
  React.useEffect(() => {
    setVisited((current) => {
      const keys = current.scope === frameScope ? current.keys : [];
      if (
        activeViewKey &&
        views.some((view) => view.key === activeViewKey) &&
        !keys.includes(activeViewKey)
      ) {
        return { scope: frameScope, keys: [...keys, activeViewKey] };
      }
      return current.scope === frameScope
        ? current
        : { scope: frameScope, keys };
    });
  }, [activeViewKey, frameScope, views]);
  const activePreview = previews.find((item) => item.key === activeViewKey);
  const browserNavigation = (key: string) => {
    const history = browserHistory[key];
    return {
      canBack: !!history && history.index > 0,
      canForward: !!history && history.index < history.entries.length - 1,
      onBack: () => onMoveBrowser?.(key, -1),
      onForward: () => onMoveBrowser?.(key, 1),
      onHome: () => onNavigateBrowser?.(key, null),
    };
  };
  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      style={getSurfaceThemeStyle(theme)}
    >
      <div
        data-slot="chatkit-workbench-header"
        className="flex min-h-14 shrink-0 items-center gap-2 px-2.5 py-2"
      >
        {mainChatHost ||
        (native?.tabs.length ?? 0) > 0 ||
        views.length > 0 ||
        previews.length > 0 ||
        newTabs.length > 0 ||
        sideChat ||
        sideChatOpening ||
        externalViewOpen ? (
          <WorkbenchTabs activeKey={activeViewKey} order={tabOrder}>
            {mainChatHost && (
              <WorkbenchTab
                key={MAIN_CHAT_VIEW_KEY}
                label={t('workbench.mainChat')}
                icon={<MessageSquare size={16} />}
                selected={activeViewKey === MAIN_CHAT_VIEW_KEY}
                id={mainChatTabId}
                panelId={`${mainChatTabId}-panel`}
                onSelect={() => onSelect(MAIN_CHAT_VIEW_KEY)}
              />
            )}
            {native &&
              onCloseNative &&
              native.tabs.map((tab) => (
                <NativeWorkbenchTabs
                  key={tab.key}
                  tabs={[tab]}
                  dirty={native.dirty}
                  activeKey={activeViewKey}
                  onSelect={onSelect}
                  onClose={onCloseNative}
                />
              ))}
            {externalViewOpen && (
              <WorkbenchTab
                key={EXTERNAL_ASSISTANTS_VIEW_KEY}
                label={t('workbench.externalAssistants.title')}
                icon={<Bot size={16} />}
                selected={activeViewKey === EXTERNAL_ASSISTANTS_VIEW_KEY}
                id={externalTabId}
                panelId={`${externalTabId}-panel`}
                onSelect={() => onSelect(EXTERNAL_ASSISTANTS_VIEW_KEY)}
                close={{
                  label: t('workbench.externalAssistants.close'),
                  onClick: onCloseExternal,
                }}
              />
            )}
            {(sideChat || sideChatOpening) && (
              <WorkbenchTab
                key={SIDE_CHAT_VIEW_KEY}
                label={sideChat?.title ?? t('workbench.sideChat.title')}
                icon={<MessageSquarePlus size={16} />}
                selected={activeViewKey === SIDE_CHAT_VIEW_KEY}
                onSelect={() => onSelect(SIDE_CHAT_VIEW_KEY)}
                close={
                  sideChat && activeViewKey === SIDE_CHAT_VIEW_KEY
                    ? {
                        label: `${t('workbench.close')}: ${t('workbench.sideChat.title')}`,
                        onClick: onRequestCloseSideChat,
                      }
                    : undefined
                }
              />
            )}
            {previews.map((preview) => (
              <PreviewTabs
                key={preview.key}
                previews={[preview]}
                activeKey={activeViewKey}
                onSelect={onSelect}
                onClose={onClosePreview}
              />
            ))}
            {views.map((view) => {
              const selected = view.key === activeViewKey;
              const label = resolveManifestText(
                view.workbench?.menu?.label ?? view.title,
                view.key,
                locale,
              );
              return (
                <WorkbenchTab
                  key={view.key}
                  label={label}
                  selected={selected}
                  onSelect={() => onSelect(view.key)}
                  icon={
                    <IconDefinitionRenderer
                      icon={view.workbench?.menu?.icon ?? view.icon}
                      size={16}
                      fallback={<PanelRight size={16} />}
                    />
                  }
                  close={
                    selected
                      ? {
                          label: `${t('workbench.close')}: ${label}`,
                          onClick: () =>
                            onCloseView ? onCloseView(view.key) : onClose(),
                        }
                      : undefined
                  }
                />
              );
            })}
            {newTabs.map((key) => (
              <WorkbenchTab
                key={key}
                label={t('workbench.newTab')}
                icon={<Globe size={16} />}
                selected={activeViewKey === key}
                id={key}
                panelId={`${key}-panel`}
                onSelect={() => onSelect(key)}
                close={{
                  label: t('workbench.closeNewTab'),
                  onClick: () => onCloseNewTab(key),
                }}
              />
            ))}
          </WorkbenchTabs>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onNewTab}
              aria-label={t('workbench.newTab')}
              className="flex size-8 shrink-0 items-center justify-center rounded-[var(--chat-item-radius)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('workbench.newTab')}</TooltipContent>
        </Tooltip>
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

      {error &&
        activeView &&
        activeViewKey !== MAIN_CHAT_VIEW_KEY &&
        !newTabs.includes(activeViewKey ?? '') && (
          <div
            role="alert"
            className="flex items-center gap-2 border-b px-3 py-2 text-sm text-destructive"
          >
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={onReload}
              className="rounded-md px-2 py-1 hover:bg-muted"
            >
              {t('workbench.retry')}
            </button>
          </div>
        )}

      <div className="relative min-h-0 flex-1">
        {mainChatHost && (
          <div
            id={`${mainChatTabId}-panel`}
            role="tabpanel"
            aria-labelledby={mainChatTabId}
            hidden={activeViewKey !== MAIN_CHAT_VIEW_KEY}
            className="h-full min-h-0"
          >
            <div ref={mainChatHost} className="contents" />
          </div>
        )}
        {native && onOpenNativeFile && (
          <NativeWorkbenchContent
            tabs={native.tabs}
            activeKey={activeViewKey}
            visible={visible}
            client={stream.client}
            scope={fileScope}
            conversationId={stream.conversationId}
            projectId={stream.projectId}
            register={native.register}
            onOpenFile={onOpenNativeFile}
            onPreviewFile={native.previewFile}
            revision={fileRevision}
            onSaved={refreshFiles}
          />
        )}
        {newTabs.map((key) => (
          <div
            key={key}
            id={`${key}-panel`}
            role="tabpanel"
            aria-labelledby={key}
            hidden={activeViewKey !== key}
            className="h-full min-h-0"
          >
            <WorkbenchStartPage
              navigation={{ ...browserNavigation(key), onHome: undefined }}
              views={availableViews}
              openedViewKeys={views.map((view) => view.key)}
              recentFiles={native?.recent}
              onOpenTool={(tool) => onOpenNative?.(tool, key)}
              onOpenFile={(file) => onOpenNativeFile?.(file, key)}
              conversationReady={Boolean(
                stream.threadId && stream.conversationId,
              )}
              sideChatEnabled={sideChatEnabled}
              recent={recent}
              locale={locale}
              apiUrl={stream.apiUrl}
              loading={loading}
              error={error}
              onReload={onReload}
              onSelectView={(viewKey) => onNavigateNewTab(key, viewKey)}
              onOpenPreview={(preview) => onPreviewFromNewTab(key, preview)}
            />
          </div>
        ))}
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
        {externalViewOpen && (
          <div
            role="tabpanel"
            id={`${externalTabId}-panel`}
            aria-labelledby={externalTabId}
            hidden={activeViewKey !== EXTERNAL_ASSISTANTS_VIEW_KEY}
            className="h-full min-h-0"
          >
            <ExternalAssistantView
              runs={externalRuns}
              selectedId={selectedExternalId}
              onSelect={onSelectExternal}
              active={visible && activeViewKey === EXTERNAL_ASSISTANTS_VIEW_KEY}
              messages={workbenchMessages}
              organizationId={stream.organizationId}
              apiUrl={stream.apiUrl}
              mcpApps={options?.mcpApps}
              messagePresentation={options?.messagePresentation}
              hasMore={stream.historyMessagePagination?.hasMore}
              loadingMore={stream.historyMessagePagination?.isLoadingMore}
              onLoadMore={() => {
                void stream.loadMoreConversationMessages();
              }}
            />
          </div>
        )}
        {previews.map((preview) => (
          <div
            key={preview.key}
            hidden={activeViewKey !== preview.key}
            className="h-full min-h-0"
          >
            {preview.kind === 'browser' ? (
              <WorkbenchBrowserPreview
                preview={preview}
                recent={recent}
                apiUrl={stream.apiUrl}
                navigation={browserNavigation(preview.key)}
                onNavigate={(next) => onNavigateBrowser?.(preview.key, next)}
              />
            ) : (
              <WorkbenchPreviewContent preview={preview} />
            )}
          </div>
        ))}
        {views
          .filter(
            (view) =>
              (visited.scope === frameScope &&
                visited.keys.includes(view.key)) ||
              view.key === activeViewKey,
          )
          .map((view) => (
            <div
              key={JSON.stringify([frameScope, view.key])}
              hidden={view.key !== activeViewKey}
              className="h-full min-h-0"
            >
              <RemoteViewFrame
                manifest={view}
                hostId={hostId}
                runtimeScope={runtimeScope}
                locale={locale}
                title={resolveManifestText(view.title, view.key, locale)}
                hostEvent={hostEvent}
                viewHosts={viewHosts}
                onNotify={onNotify}
                onClientCommand={onClientCommand}
                initialQuery={viewQueries[view.key]}
              />
            </div>
          ))}
        {(mainChatHost && activeViewKey === MAIN_CHAT_VIEW_KEY) ||
        native?.tabs.some((tab) => tab.key === activeViewKey) ||
        newTabs.includes(activeViewKey ?? '') ||
        activePreview ? null : activeViewKey ===
          EXTERNAL_ASSISTANTS_VIEW_KEY ? null : activeViewKey ===
          SIDE_CHAT_VIEW_KEY ? (
          !sideChat && sideChatOpening ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              {t('workbench.loading')}
            </div>
          ) : null
        ) : activeView ? null : loading ? (
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
        externalAssistants: { enabled: false },
      },
      pet: false,
    };
  }, [options, session.threadId]);

  return (
    <WorkbenchContext.Provider value={disabledWorkbenchContext}>
      <StreamProvider
        apiKey={stream.apiKey}
        getClientSecret={stream.refreshClientSecret}
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
    </WorkbenchContext.Provider>
  );
}
