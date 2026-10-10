import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { History, Pencil, Settings } from 'lucide-react';
import type * as React from 'react';
import { ChatHeaderActions } from './ChatHeaderActions';
import { ConversationTitle } from '../../history/ConversationTitle';
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
  > &
  Pick<ReturnType<typeof useChatBranchState>, 'isChangingBranch'> &
  Pick<
    ReturnType<typeof useChatPetSettings>,
    'petDisabled' | 'petSettingsOpen' | 'setPetSettingsOpen'
  > &
  Pick<
    ReturnType<typeof useChatConversationActions>,
    'handleNewThread' | 'handleSelectThread' | 'handleDeleteThread'
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
  handleSelectThread,
  handleDeleteThread,
  characterPresentation = false,
}: AssistantHeaderProps): ChatHeaderProps {
  return {
    visible: surface === 'main' && options?.header?.enabled !== false,
    columnRef: chatColumnRef,
    style: chatColumnStyle,
    characterPresentation,
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
    subtitle: (
      <ConversationTitle
        key={stream.conversationId ?? stream.threadId ?? 'new'}
        title={assistantStatusText}
        onSave={
          currentThread &&
          stream.threadId &&
          stream.isReady &&
          !isHistoryLoading &&
          !isChangingBranch
            ? async (nextTitle) => {
                await updateThread(currentThread.recordId, {
                  title: nextTitle,
                });
              }
            : undefined
        }
      />
    ),
    actions: (
      <>
        <ChatHeaderActions
          moreButtonRef={headerMoreButtonRef}
          onMenuCloseAutoFocus={(event) => {
            if (petSettingsOpen || historyOpen) event.preventDefault();
          }}
          menu={
            !petDisabled || history?.enabled !== false ? (
              <>
                {!petDisabled && (
                  <DropdownMenuItem onSelect={() => setPetSettingsOpen(true)}>
                    <Settings size={16} />
                    {t('settings.open')}
                  </DropdownMenuItem>
                )}
                {history?.enabled !== false && (
                  <>
                    <DropdownMenuItem
                      onSelect={handleNewThread}
                      disabled={missingConfig || isHistoryLoading}
                    >
                      <Pencil size={16} />
                      {t(
                        activeProjectId
                          ? 'history.newThreadInProject'
                          : 'history.newThread',
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setHistoryOpen(true)}
                      disabled={missingConfig || isHistoryLoading}
                    >
                      <History size={16} />
                      {t('history.threadHistory')}
                    </DropdownMenuItem>
                  </>
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
            isRefreshing={messageHistory.isLoading}
            showDelete={history?.showDelete !== false}
            disabled={missingConfig || isHistoryLoading}
          />
        )}
      </>
    ),
  };
}
