import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { History, Minus, MoreHorizontal, Pencil, Settings } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../../lib/utils';
import { WorkbenchToggleButton } from '../../../workbench/context';
import { ConversationTitle } from '../../history/ConversationTitle';
import { HistorySidebar } from '../../history/HistorySidebar';
import { TaskSummaryTrigger } from '../../task-summary/TaskSummary';
import { ChatkitAvatar } from '../../ui/chatkit-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import type { useChatHistory } from '../history/useChatHistory';
import type { useChatHost } from '../host/useChatHost';
import type { useChatPetSettings } from '../pet/useChatPetSettings';
import type { useChatAssistant } from '../session/useChatAssistant';
import type { useChatBranchState } from '../session/useChatBranchState';
import type { useChatConversationActions } from '../session/useChatConversationActions';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatTaskSummary } from '../summary/useChatTaskSummary';

type ChatHeaderProps = Pick<
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
  };

export function ChatHeader({
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
}: ChatHeaderProps) {
  return (
    surface === 'main' &&
    options?.header?.enabled !== false && (
      <div
        data-slot="chatkit-chat-header-container"
        className="sticky top-0 z-10 w-full shrink-0 bg-background"
      >
        <div
          ref={chatColumnRef}
          data-slot="chatkit-chat-header"
          className="mx-auto flex w-full items-center justify-between border-b p-2"
          style={chatColumnStyle}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <div className="relative shrink-0">
              <ChatkitAvatar
                avatar={assistantAvatar}
                className="h-9 w-9 border border-border/60"
                label={assistantTitle}
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-lg font-semibold truncate"
                title={assistantTitle}
              >
                {assistantTitle}
              </h2>
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
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {(!petDisabled || history?.enabled !== false) && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        ref={headerMoreButtonRef}
                        type="button"
                        className={cn(
                          'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md',
                          'text-muted-foreground hover:text-foreground hover:bg-muted',
                          'transition-colors duration-150',
                        )}
                        aria-label={t('chat.moreActions')}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t('chat.moreActions')}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="end"
                  className="min-w-52"
                  onCloseAutoFocus={(event) => {
                    if (petSettingsOpen || historyOpen) {
                      event.preventDefault();
                    }
                  }}
                >
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
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {taskSummaryAvailable && (
              <TaskSummaryTrigger
                {...taskSummaryProps}
                displayMode={taskSummaryDocked ? 'docked' : 'popover'}
                open={taskSummaryOpen}
                onOpenChange={handleTaskSummaryOpenChange}
              />
            )}

            {canMinimizeToPet && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-8 w-8">
                    <button
                      type="button"
                      onClick={handleMinimizeToPet}
                      className={cn(
                        'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md',
                        'text-muted-foreground hover:text-foreground hover:bg-muted',
                        'transition-colors duration-150',
                      )}
                      aria-label={t('chat.minimizeToPet')}
                    >
                      <Minus size={16} />
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('chat.minimizeToPet')}
                </TooltipContent>
              </Tooltip>
            )}

            <WorkbenchToggleButton />

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
          </div>
        </div>
      </div>
    )
  );
}
