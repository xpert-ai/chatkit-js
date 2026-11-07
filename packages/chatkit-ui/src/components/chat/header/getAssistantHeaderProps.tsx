import {
  activeConversationTarget,
  getConversationActions,
  type ConversationActionContext,
} from '../../conversation/conversation-actions';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { History, Settings, Square } from 'lucide-react';
import type * as React from 'react';
import { ChatHeaderActions } from './ChatHeaderActions';
import { ConversationTitle } from '../../history/ConversationTitle';
import { conversationMenuItemClassName } from '../../conversation/ConversationMenu';
import { HistorySidebar } from '../../history/HistorySidebar';
import { TaskSummaryTrigger } from '../../task-summary/TaskSummary';
import { ChatkitAvatar } from '../../ui/chatkit-avatar';
import { DropdownMenuItem } from '../../ui/dropdown-menu';
import type { useChatHistory } from '../history/useChatHistory';
import type { useChatHost } from '../host/useChatHost';
import type { useChatPetSettings } from '../pet/useChatPetSettings';
import type { useChatAssistant } from '../session/useChatAssistant';
import type { useChatBranchState } from '../session/useChatBranchState';
import type { useChatConversationActions } from '../session/useChatConversationActions';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatRunControl } from '../session/useChatRunControl';
import type { useChatTaskSummary } from '../summary/useChatTaskSummary';

type AssistantHeaderProps = Pick<
  ReturnType<typeof useChatAssistant>,
  'assistantAvatar' | 'assistantTitle'
> &
  Pick<
    ReturnType<typeof useChatEnvironment>,
    | 'stream'
    | 'isHistoryLoading'
    | 'history'
    | 't'
    | 'missingConfig'
    | 'activeProjectId'
  > &
  Pick<
    ReturnType<typeof useChatHistory>,
    | 'assistantStatusText'
    | 'currentThread'
    | 'updateThread'
    | 'historyOpen'
    | 'setHistoryOpen'
    | 'messageHistory'
    | 'historyQuery'
    | 'setHistoryQuery'
    | 'effectiveHistoryScope'
    | 'setHistoryScope'
    | 'historyProjectFilter'
    | 'setHistoryProjectFilter'
  > &
  Pick<ReturnType<typeof useChatBranchState>, 'isChangingBranch'> &
  Pick<
    ReturnType<typeof useChatRunControl>,
    | 'canStopRun'
    | 'isResumingRun'
    | 'isStoppingRun'
    | 'handleComposerRunControl'
  > &
  Pick<
    ReturnType<typeof useChatPetSettings>,
    'petDisabled' | 'petSettingsOpen' | 'setPetSettingsOpen'
  > &
  Pick<
    ReturnType<typeof useChatConversationActions>,
    | 'handleNewThread'
    | 'handleSelectThread'
    | 'handleDeleteThread'
    | 'isCurrentConversationView'
  > &
  Pick<
    ReturnType<typeof useChatTaskSummary>,
    | 'taskSummaryAvailable'
    | 'taskSummaryProps'
    | 'taskSummaryDocked'
    | 'taskSummaryOpen'
    | 'handleTaskSummaryOpenChange'
  > &
  Pick<
    ReturnType<typeof useChatHost>,
    'canMinimizeToPet' | 'handleMinimizeToPet'
  > & {
    surface: 'main' | 'side';
    options: ChatKitOptions | null | undefined;
    chatColumnRef: React.RefObject<HTMLDivElement | null>;
    chatColumnStyle: React.CSSProperties | undefined;
    headerMoreButtonRef: React.RefObject<HTMLButtonElement | null>;
    restoreHeaderFocus: (event: Event) => void;
    characterPresentation?: boolean;
    openSideChat?: () => Promise<void>;
  };

import type { ChatHeaderProps } from './ChatHeader';
export function getAssistantHeaderProps({
  surface,
  options,
  chatColumnRef,
  chatColumnStyle,
  assistantAvatar,
  assistantTitle,
  stream,
  assistantStatusText,
  currentThread,
  isHistoryLoading,
  isChangingBranch,
  canStopRun,
  isResumingRun,
  isStoppingRun,
  handleComposerRunControl,
  updateThread,
  petDisabled,
  history,
  headerMoreButtonRef,
  t,
  petSettingsOpen,
  historyOpen,
  setPetSettingsOpen,
  handleNewThread,
  missingConfig,
  activeProjectId,
  setHistoryOpen,
  taskSummaryAvailable,
  taskSummaryProps,
  taskSummaryDocked,
  taskSummaryOpen,
  handleTaskSummaryOpenChange,
  canMinimizeToPet,
  handleMinimizeToPet,
  restoreHeaderFocus,
  messageHistory,
  historyQuery,
  setHistoryQuery,
  effectiveHistoryScope,
  setHistoryScope,
  historyProjectFilter,
  setHistoryProjectFilter,
  handleSelectThread,
  handleDeleteThread,
  isCurrentConversationView,
  characterPresentation = false,
  openSideChat,
}: AssistantHeaderProps): ChatHeaderProps {
  const conversationActions: ConversationActionContext = {
    client: stream.client,
    scopeKey: JSON.stringify([
      stream.apiUrl,
      stream.organizationId,
      stream.assistantId,
      stream.projectId,
      stream.conversationId,
      stream.threadId,
    ]),
    ready:
      stream.isReady &&
      stream.runtimeScopeReady !== false &&
      !missingConfig &&
      !isHistoryLoading &&
      !isChangingBranch &&
      (!stream.connectionState || stream.connectionState === 'connected'),
    activeConversationId: stream.conversationId,
    activeThreadId: stream.threadId,
    running: stream.isLoading,
    history,
    branchEnabled: options?.threadItemActions?.branch !== false,
    sideChat: openSideChat,
    rename: async (target, title) => {
      await updateThread(target.recordId, { title });
      if (isCurrentConversationView()) messageHistory.refresh();
    },
    delete: handleDeleteThread,
    navigate: (record) => {
      setHistoryOpen(false);
      handleSelectThread({
        recordId: record.id,
        id: record.threadId,
        title: record.title || t('history.threadFallback'),
        status: record.status ?? 'idle',
        projectId: record.projectId ?? null,
      });
      messageHistory.refresh();
    },
  };
  const target = activeConversationTarget(
    conversationActions,
    currentThread,
    stream.conversation,
    assistantStatusText,
    activeProjectId,
  );
  const inlineRename =
    target &&
    getConversationActions(
      conversationActions,
      target,
      {
        id: target.recordId,
        threadId: target.id,
        title: target.title,
        status: target.status,
      },
      null,
    ).rename;
  return {
    visible: surface === 'main' && options?.header?.enabled !== false,
    columnRef: chatColumnRef,
    style: chatColumnStyle,
    characterPresentation,
    showIdentity: options?.header?.identity?.enabled === true,
    newThread:
      history?.enabled !== false
        ? {
            label: t(
              activeProjectId
                ? 'history.newThreadInProject'
                : 'history.newThread',
            ),
            disabled: missingConfig || isHistoryLoading,
            onClick: handleNewThread,
          }
        : undefined,
    avatar: (
      <div className="relative shrink-0">
        <ChatkitAvatar
          avatar={assistantAvatar}
          className="h-9 w-9 border border-border/60"
          label={assistantTitle}
        />
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
      </div>
    ),
    title: assistantTitle,
    conversationTitle: target ? (
      <ConversationTitle
        key={stream.conversationId ?? stream.threadId ?? 'new'}
        title={target.title}
        variant="toolbar"
        onSave={
          target && inlineRename?.visible && !inlineRename.disabled
            ? async (nextTitle) => {
                await conversationActions.rename(target, nextTitle);
              }
            : undefined
        }
      />
    ) : undefined,
    subtitle: !target ? (
      <ConversationTitle title={assistantStatusText} />
    ) : undefined,
    actions: (
      <>
        <ChatHeaderActions
          conversationMenu={
            target ? { context: conversationActions, target } : undefined
          }
          moreButtonRef={headerMoreButtonRef}
          onMenuCloseAutoFocus={(event) => {
            if (petSettingsOpen || historyOpen) event.preventDefault();
          }}
          menu={
            !petDisabled || history?.enabled !== false || canStopRun ? (
              <>
                {!petDisabled && (
                  <DropdownMenuItem
                    className={conversationMenuItemClassName}
                    onSelect={() => setPetSettingsOpen(true)}
                  >
                    <Settings />
                    {t('settings.open')}
                  </DropdownMenuItem>
                )}
                {history?.enabled !== false && (
                  <DropdownMenuItem
                    className={conversationMenuItemClassName}
                    onSelect={() => setHistoryOpen(true)}
                    disabled={missingConfig || isHistoryLoading}
                  >
                    <History />
                    {t('history.threadHistory')}
                  </DropdownMenuItem>
                )}
                {canStopRun && (
                  <DropdownMenuItem
                    className={conversationMenuItemClassName}
                    disabled={
                      isChangingBranch || isResumingRun || isStoppingRun
                    }
                    onSelect={() => void handleComposerRunControl('stop')}
                  >
                    <Square />
                    {t('threadControl.terminate')}
                  </DropdownMenuItem>
                )}
              </>
            ) : undefined
          }
          summary={
            taskSummaryAvailable ? (
              <TaskSummaryTrigger
                {...taskSummaryProps}
                displayMode={taskSummaryDocked ? 'docked' : 'popover'}
                open={taskSummaryOpen}
                onOpenChange={handleTaskSummaryOpenChange}
              />
            ) : undefined
          }
          onMinimize={canMinimizeToPet ? handleMinimizeToPet : undefined}
        />

        {history?.enabled !== false && (
          <HistorySidebar
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            showTrigger={false}
            onCloseAutoFocus={restoreHeaderFocus}
            threads={messageHistory.threads}
            total={messageHistory.total}
            query={historyQuery}
            onQueryChange={setHistoryQuery}
            hasMore={messageHistory.hasMore}
            onLoadMore={messageHistory.loadMore}
            isLoadingMore={messageHistory.isLoadingMore}
            error={messageHistory.error}
            loadMoreError={messageHistory.loadMoreError}
            scope={effectiveHistoryScope}
            onScopeChange={setHistoryScope}
            projectFilter={historyProjectFilter}
            onProjectFilterChange={setHistoryProjectFilter}
            hasCurrentProject={Boolean(activeProjectId)}
            currentThreadId={stream.threadId ?? undefined}
            onNewThread={handleNewThread}
            newThreadLabel={t(
              activeProjectId
                ? 'history.newThreadInProject'
                : 'history.newThread',
            )}
            onRefresh={messageHistory.refresh}
            onSelectThread={handleSelectThread}
            onDeleteThread={handleDeleteThread}
            conversationActions={conversationActions}
            isRefreshing={messageHistory.isLoading}
            showDelete={history?.showDelete !== false}
            disabled={missingConfig || isHistoryLoading}
          />
        )}
      </>
    ),
  };
}
