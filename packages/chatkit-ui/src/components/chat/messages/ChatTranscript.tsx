import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type * as React from 'react';
import { cn } from '../../../lib/utils';
import type { useStreamContext } from '../../../providers/Stream';
import { ThreadHistoryStatus } from '../../history/ThreadHistoryStatus';
import { MessageList } from '../../thread/MessageList';
import { StartScreen } from '../../thread/StartScreen';
import type { useChatInput } from '../composer/useChatInput';
import type { useChatSubmission } from '../composer/useChatSubmission';
import type { useChatHost } from '../host/useChatHost';
import type { useChatPetSettings } from '../pet/useChatPetSettings';
import type { useRuntimeCapabilitiesState } from '../runtime-capabilities';
import type { useChatAssistant } from '../session/useChatAssistant';
import type { useChatBranchState } from '../session/useChatBranchState';
import type { useChatConversationActions } from '../session/useChatConversationActions';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatRunControl } from '../session/useChatRunControl';
import type { useChatStreamingFeedback } from './useChatStreamingFeedback';
import type { useChatViewport } from './useChatViewport';

type ChatTranscriptProps = Pick<
  ReturnType<typeof useChatEnvironment>,
  | 'historyError'
  | 't'
  | 'showMissingConfig'
  | 'missingConfigDetailMessage'
  | 'stream'
  | 'startScreen'
> &
  Pick<
    ReturnType<typeof useChatConversationActions>,
    | 'conversationBranch'
    | 'loadThreadHistory'
    | 'handlePromptEdit'
    | 'saveEditedMessage'
  > &
  Pick<
    ReturnType<typeof useChatViewport>,
    | 'canLoadMoreMessages'
    | 'isLoadingMoreMessages'
    | 'handleLoadMoreMessages'
    | 'disableAutoFollow'
    | 'setMessageNavigationAnchor'
  > &
  Pick<ReturnType<typeof useChatInput>, 'handlePromptClick'> &
  Pick<ReturnType<typeof useChatHost>, 'inlineApproval'> &
  Pick<
    ReturnType<typeof useChatAssistant>,
    'assistantTitle' | 'assistantAvatar'
  > &
  Pick<
    ReturnType<typeof useChatRunControl>,
    'isVisibleStreaming' | 'isPauseActive'
  > &
  Pick<
    ReturnType<typeof useChatStreamingFeedback>,
    'lastStreamOutputAtRef' | 'streamingNow' | 'showLoadingDots'
  > &
  Pick<ReturnType<typeof useChatPetSettings>, 'effectivePet'> &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    'runtimeCapabilityOptions'
  > &
  Pick<
    ReturnType<typeof useChatBranchState>,
    | 'isChangingBranch'
    | 'branchState'
    | 'editingMessageId'
    | 'editRequestRef'
    | 'setEditingMessageId'
  > &
  Pick<ReturnType<typeof useChatSubmission>, 'handleRetry'> & {
    isInitialComposer: boolean;
    chatColumnStyle: React.CSSProperties | undefined;
    errorMessage: string | undefined;
    messages: ReturnType<typeof useStreamContext>['messages'];
    isSubmissionBlocked: boolean;
    isPromptEditDisabled: boolean;
    options: ChatKitOptions | null | undefined;
    currentThreadIsRunning: boolean;
  };

export function ChatTranscript({
  isInitialComposer,
  chatColumnStyle,
  errorMessage,
  historyError,
  conversationBranch,
  t,
  showMissingConfig,
  missingConfigDetailMessage,
  stream,
  messages,
  loadThreadHistory,
  canLoadMoreMessages,
  startScreen,
  handlePromptClick,
  handlePromptEdit,
  isSubmissionBlocked,
  isPromptEditDisabled,
  inlineApproval,
  options,
  assistantTitle,
  assistantAvatar,
  isVisibleStreaming,
  currentThreadIsRunning,
  isPauseActive,
  lastStreamOutputAtRef,
  streamingNow,
  showLoadingDots,
  effectivePet,
  runtimeCapabilityOptions,
  isLoadingMoreMessages,
  handleLoadMoreMessages,
  isChangingBranch,
  disableAutoFollow,
  branchState,
  handleRetry,
  editingMessageId,
  editRequestRef,
  setEditingMessageId,
  saveEditedMessage,
  setMessageNavigationAnchor,
}: ChatTranscriptProps) {
  return (
    <div
      data-slot="chatkit-chat-content"
      className={cn(
        'mx-auto w-full p-4',
        isInitialComposer ? 'mt-auto shrink-0 pb-0' : 'flex-1',
      )}
      style={chatColumnStyle}
    >
      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      {historyError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {historyError}
        </div>
      )}
      {conversationBranch.error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t('messageActions.branchFailed')}
          <p className="mt-1 text-xs">
            {/^(?:failed to fetch|network\s*(?:request\s*)?(?:failed|error)|load failed)$/i.test(
              conversationBranch.error,
            )
              ? t('messageActions.branchNetworkError')
              : conversationBranch.error}
          </p>
        </div>
      )}
      {showMissingConfig && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {missingConfigDetailMessage}
        </div>
      )}
      <ThreadHistoryStatus
        state={stream.historyLoad}
        isEmpty={
          Boolean(stream.threadId) && messages.length === 0 && !stream.isLoading
        }
        onRetry={() => {
          if (stream.threadId) void loadThreadHistory(stream.threadId);
        }}
      />
      {!stream.threadId && messages.length === 0 && !canLoadMoreMessages ? (
        <StartScreen
          startScreen={startScreen}
          onPromptClick={handlePromptClick}
          onPromptEdit={handlePromptEdit}
          promptSendDisabled={isSubmissionBlocked}
          promptEditDisabled={isPromptEditDisabled}
          className="px-4 pb-4 pt-2"
        />
      ) : (
        <MessageList
          approval={inlineApproval.card}
          approvalToolCallId={stream.pendingHITLRequest?.request.toolCallId}
          messagePresentation={options?.messagePresentation}
          assistantActor={{
            id: `assistant:${stream.assistantId ?? 'current'}`,
            kind: 'assistant',
            name: assistantTitle,
            avatar: assistantAvatar,
          }}
          messages={messages}
          assistantTitle={assistantTitle}
          isLoading={isVisibleStreaming}
          isThreadRunning={currentThreadIsRunning}
          isThreadPaused={isPauseActive}
          lastStreamOutputAt={lastStreamOutputAtRef.current}
          streamingNow={streamingNow}
          showLoadingDots={showLoadingDots && !stream.isDisplayPaused}
          organizationId={stream.organizationId}
          apiUrl={stream.apiUrl}
          pet={effectivePet}
          mcpApps={options?.mcpApps}
          runtimeCapabilityOptions={runtimeCapabilityOptions}
          canLoadMoreMessages={canLoadMoreMessages}
          isLoadingMoreMessages={isLoadingMoreMessages}
          onLoadMore={handleLoadMoreMessages}
          onBranch={
            options?.threadItemActions?.branch !== false &&
            stream.conversationId &&
            typeof stream.client?.conversations?.branch === 'function' &&
            !isChangingBranch
              ? (messageId) => {
                  void conversationBranch.branch(messageId);
                }
              : undefined
          }
          onMessageActionTooltipOpen={disableAutoFollow}
          branchingMessageId={conversationBranch.pendingMessageId}
          onRetry={
            branchState.current?.status !== 'paused' &&
            branchState.current?.status !== 'pausing' &&
            !stream.isLoading
              ? handleRetry
              : undefined
          }
          editing={{
            messageId: editingMessageId,
            enabled: Boolean(branchState.current) && !isChangingBranch,
            onStart: (messageId) => {
              editRequestRef.current = null;
              setEditingMessageId(messageId);
            },
            onCancel: () => setEditingMessageId(null),
            onSave: saveEditedMessage,
          }}
          onMessageAnchor={setMessageNavigationAnchor}
        />
      )}
    </div>
  );
}
