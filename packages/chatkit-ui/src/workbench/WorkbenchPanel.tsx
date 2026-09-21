import * as React from 'react';
import type {
  Client,
  XpertExtensionViewManifest,
  XpertRemoteViewHostEventMessage,
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
  X,
  MessageSquarePlus,
  Bot,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { IconDefinitionRenderer } from '../components/ui/icon-definition';
import { RemoteViewFrame, type RemoteViewHostsClient } from './RemoteViewFrame';

export const SIDE_CHAT_VIEW_KEY = 'chatkit.native.side-chat';

export type SideChatSession = {
  sourceThreadId: string;
  threadId: string;
  title: string;
  referenceRequest: ChatReferenceRequest;
};

type WorkbenchViewHostsClient = Pick<Client['viewHosts'], 'listSlotViews'> &
  RemoteViewHostsClient;

type WorkbenchPanelProps = {
  visible: boolean;
  views: XpertExtensionViewManifest[];
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
  visible,
  views,
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
  const externalTabId = React.useId();
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 px-2.5">
        {views.length > 0 || sideChat || sideChatOpening || externalViewOpen ? (
          <div
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
            role="tablist"
            aria-label={t('workbench.views')}
          >
            {externalViewOpen && (
              <div
                className={cn(
                  'flex h-9 max-w-64 shrink-0 items-center rounded-lg',
                  activeViewKey === EXTERNAL_ASSISTANTS_VIEW_KEY
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                <button
                  type="button"
                  role="tab"
                  id={externalTabId}
                  aria-controls={`${externalTabId}-panel`}
                  aria-selected={activeViewKey === EXTERNAL_ASSISTANTS_VIEW_KEY}
                  onClick={() => onSelect(EXTERNAL_ASSISTANTS_VIEW_KEY)}
                  className="flex h-full min-w-0 items-center gap-2 px-3 text-sm font-medium"
                >
                  <Bot size={17} aria-hidden="true" />
                  <span className="truncate">
                    {t('workbench.externalAssistants.title')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onCloseExternal}
                  aria-label={t('workbench.externalAssistants.close')}
                  className="mr-1 rounded-lg p-1 text-muted-foreground hover:bg-background/80"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {(sideChat || sideChatOpening) && (
              <div
                className={cn(
                  'flex h-9 max-w-64 shrink-0 items-center rounded-xl transition-colors',
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
              hasMore={stream.historyMessagePagination?.hasMore}
              loadingMore={stream.historyMessagePagination?.isLoadingMore}
              onLoadMore={() => {
                void stream.loadMoreConversationMessages();
              }}
            />
          </div>
        )}
        {activeViewKey ===
        EXTERNAL_ASSISTANTS_VIEW_KEY ? null : activeViewKey ===
          SIDE_CHAT_VIEW_KEY ? (
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
        externalAssistants: { enabled: false },
      },
      pet: false,
    };
  }, [options, session.threadId]);

  return (
    <WorkbenchContext.Provider value={disabledWorkbenchContext}>
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
    </WorkbenchContext.Provider>
  );
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
