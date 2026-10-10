import { isCallEndedContent } from '@xpert-ai/chatkit-types';
import { CallEndedMessage } from './messages/call-ended';
import { PresentationScrollAnchor } from './PresentationScrollAnchor';
import { MessageBubble } from './messages/message-bubble';
import {
  getMessageBubbleText,
  getBubbleCompletionStatus,
  resolveMessagePresentation,
  type MessageActor,
} from '../../lib/message-presentation';
import type { ReactNode } from 'react';
import { ChatkitAvatar } from '../ui/chatkit-avatar';
import type { ChatMessageInputCheckpoint, Message } from '@xpert-ai/xpert-sdk';
import type { StateType } from '../../providers/Stream';
import {
  getMessageSkillUsages,
  mergeChatSkillUsages,
} from '@xpert-ai/chatkit-types';
import type {
  ChatKitOptions,
  ChatkitMessage,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
  FollowUpBehavior,
} from '@xpert-ai/chatkit-types';
import { FileText } from 'lucide-react';
import type { AssistantMessageWithAgentRuns } from '../../lib/agent-run-render-tree';
import {
  getFinalAnswerText,
  groupAssistantProcessMessages,
} from '../../lib/assistant-presentation';
import { cn } from '../../lib/utils';
import {
  getAssistantStreamingStatus,
  hasRenderableAssistantMessage,
} from '../../lib/message';
import { getReferenceKey } from '../../lib/references';
import {
  getRecommendedRuntimeCapabilitiesSelection,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../../lib/runtime-capabilities';
import {
  getMessageNavigationItemId,
  type MessageNavigationSourceMessage,
} from '../../lib/message-navigation';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { ChatAttachmentFile } from '../chat/attachments';
import { ReferenceChip } from '../chat/ReferenceChip';
import { getVisibleHumanAttachments } from '../chat/message-files';
import {
  HumanRuntimeCapabilityChips,
  getRuntimeCapabilityOptionsForSelection,
} from '../chat/runtime-capabilities';
import { AssistantMessage, AssistantStreamingIndicator } from './messages/ai';
import { MessageActions } from './MessageActions';
import { MessageTimestamp } from './MessageTimestamp';
import { MessageEditor } from './MessageEditor';
import { Button } from '../ui/button';

type UploadedMessageFile = ChatAttachmentFile;

export type HumanMessageWithMeta = Message & {
  attachments?: UploadedMessageFile[];
  fileAssets?: UploadedMessageFile[];
  references?: ChatKitReference[];
  submittedInput?: string;
  referenceComposition?: ChatKitReferenceCompositionMode;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  runtimeCapabilityOptions?: RuntimeCapabilityOption[];
  model?: string;
  followUpMode?: FollowUpBehavior;
  /** Null means the server has no saved input checkpoint for branching. */
  inputCheckpoint?: ChatMessageInputCheckpoint | null;
};

type TranscriptMessage = StateType['messages'][number] | ChatkitMessage;
type TranscriptContent = TranscriptMessage['content'];

function formatMessageContent(
  content:
    | TranscriptContent
    | NonNullable<Exclude<TranscriptContent, string>>[number],
): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const textValue = (part as { text?: unknown }).text;
          return typeof textValue === 'string' ? textValue : '';
        }
        return '';
      })
      .join('');
  }

  if (content == null) return '';

  // Handle object with text property (e.g., {"type":"text","text":"..."})
  if (typeof content === 'object' && 'text' in content) {
    const textValue = (content as { text?: unknown }).text;
    return typeof textValue === 'string' ? textValue : '';
  }

  return '';
}

export type MessageListProps = {
  /** Group presentation is supplied by the trusted public timeline, never inferred from roles. */
  messageContext?: Record<
    string,
    {
      actor: MessageActor;
      actorAction?: { onClick: () => void; title?: string };
      isSelf: boolean;
      streaming?: boolean;
      before?: ReactNode;
      after?: ReactNode;
    }
  >;
  approval?: ReactNode;
  approvalToolCallId?: string;
  collapseProcess?: boolean;
  messagePresentation?: ChatKitOptions['messagePresentation'];
  assistantActor?: MessageActor;
  showActions?: boolean;
  /** Nested process entries reuse the parent answer's horizontal padding. */
  embedded?: boolean;
  messages: TranscriptMessage[];
  /** Original conversation for tool-result and interactive component lookups. */
  lookupMessages?: ChatkitMessage[];
  assistantTitle?: string;
  isLoading?: boolean;
  isThreadRunning?: boolean;
  isThreadPaused?: boolean;
  lastStreamOutputAt?: number | null;
  streamingNow?: number;
  showLoadingDots?: boolean;
  organizationId?: string;
  apiUrl?: string;
  pet?: ChatKitOptions['pet'] | null;
  mcpApps?: ChatKitOptions['mcpApps'];
  runtimeCapabilityOptions?: RuntimeCapabilityOption[];
  canLoadMoreMessages?: boolean;
  isLoadingMoreMessages?: boolean;
  onLoadMore?: () => void;
  onRetry?: (index: number) => void;
  onBranch?: (messageId: string) => void;
  onMessageActionTooltipOpen?: () => void;
  branchingMessageId?: string | null;
  onMessageAnchor?: (id: string, node: HTMLDivElement | null) => void;
  enableQuotes?: boolean;
  editing?: {
    messageId: string | null;
    enabled: boolean;
    onStart: (messageId: string) => void;
    onCancel: () => void;
    onSave: (
      message: Omit<HumanMessageWithMeta, 'content' | 'type'>,
      text: string,
    ) => Promise<void>;
  };
};

/** Shared transcript presentation for main chat and read-only workbench views. */
export function MessageList({
  messageContext,
  approval,
  approvalToolCallId,
  collapseProcess: legacyCollapseProcess = false,
  messagePresentation,
  assistantActor,
  showActions = true,
  embedded = false,
  messages,
  lookupMessages,
  assistantTitle,
  isLoading = false,
  isThreadRunning,
  isThreadPaused,
  lastStreamOutputAt,
  streamingNow,
  showLoadingDots = false,
  organizationId,
  apiUrl,
  pet,
  mcpApps,
  runtimeCapabilityOptions = [],
  canLoadMoreMessages,
  isLoadingMoreMessages,
  onLoadMore,
  onRetry,
  onBranch,
  onMessageActionTooltipOpen,
  branchingMessageId,
  onMessageAnchor,
  enableQuotes = true,
  editing,
}: MessageListProps) {
  const { t } = useChatkitTranslation();
  const { mode, collapseProcess } = resolveMessagePresentation({
    collapseProcess: legacyCollapseProcess,
    ...messagePresentation,
  });
  const bubbles = mode === 'bubbles';
  const processGroups = collapseProcess
    ? groupAssistantProcessMessages(messages as AssistantMessageWithAgentRuns[])
    : new Map<number, number[]>();
  const foldedIndexes = new Set([...processGroups.values()].flat());
  const lastAssistantIndex = messages.reduce(
    (lastIndex, message, index) =>
      !foldedIndexes.has(index) &&
      ['assistant', 'ai'].includes(String(message.type))
        ? index
        : lastIndex,
    -1,
  );
  const toolAnchor = approvalToolCallId
    ? messages.findIndex(
        (message) =>
          'tool_calls' in message &&
          Array.isArray(message.tool_calls) &&
          message.tool_calls.some(
            (call: unknown) =>
              !!call &&
              typeof call === 'object' &&
              'id' in call &&
              call.id === approvalToolCallId,
          ),
      )
    : -1;
  const approvalIndex = foldedIndexes.has(toolAnchor)
    ? ([...processGroups].find(([, indexes]) =>
        indexes.includes(toolAnchor),
      )?.[0] ?? lastAssistantIndex)
    : toolAnchor >= 0
      ? toolAnchor
      : lastAssistantIndex;
  return (
    <PresentationScrollAnchor mode={mode}>
      <div
        data-slot="chatkit-message-list"
        data-message-presentation={mode}
        className={messageContext ? 'space-y-0' : 'space-y-4'}
      >
        {canLoadMoreMessages && (
          <div className="flex items-center gap-3 py-1">
            <div className="h-px min-w-8 flex-1 bg-border" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMoreMessages}
              className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {isLoadingMoreMessages
                ? t('chat.loadingMoreMessages')
                : t('chat.loadMoreMessages')}
            </Button>
            <div className="h-px min-w-8 flex-1 bg-border" />
          </div>
        )}
        {messages.map((message, index) => {
          if (foldedIndexes.has(index)) return null;
          const call = Array.isArray(message.content)
            ? message.content.find(isCallEndedContent)
            : undefined;
          if (call)
            return (
              <div
                key={message.id ?? index}
                data-message-id={message.id}
                ref={(node) => {
                  if (message.id) onMessageAnchor?.(message.id, node);
                }}
              >
                <CallEndedMessage call={call} />
              </div>
            );
          const processIndexes = processGroups.get(index);
          const messageType = String(message.type);
          if (bubbles && messageType === 'tool') return null;
          const isHumanMessage =
            messageType === 'human' || messageType === 'user';
          const isAssistantMessage =
            messageType === 'assistant' || messageType === 'ai';
          const context = message.id ? messageContext?.[message.id] : undefined;
          const isSelf = context ? context.isSelf : isHumanMessage;
          const previousId = messages[index - 1]?.id;
          const nextId = messages[index + 1]?.id;
          const continuesGroup =
            !!context &&
            !!previousId &&
            messageContext?.[previousId]?.actor.id === context.actor.id;
          const endsGroup =
            !!context &&
            (!nextId ||
              messageContext?.[nextId]?.actor.id !== context.actor.id);

          const isStreamingMessage =
            context?.streaming ?? (isLoading && index === messages.length - 1);
          const streamingStatus = isAssistantMessage
            ? getAssistantStreamingStatus(
                {
                  ...(message as ChatkitMessage),
                  lastStreamOutputAt,
                },
                isStreamingMessage,
                { now: streamingNow },
              )
            : null;

          if (
            isAssistantMessage &&
            !hasRenderableAssistantMessage(message as ChatkitMessage) &&
            !(message as AssistantMessageWithAgentRuns).agentRuns?.length &&
            !streamingStatus &&
            !(bubbles && getBubbleCompletionStatus(message.status)) &&
            !(approval && index === approvalIndex)
          ) {
            return null;
          }

          const messageContent =
            typeof message.content === 'string'
              ? message.content
              : Array.isArray(message.content)
                ? message.content
                    .map((part) => formatMessageContent(part))
                    .join('')
                : formatMessageContent(message.content);
          const hasPlainRenderableContent = messageContent.trim().length > 0;
          const humanMessage = message as HumanMessageWithMeta;
          const humanReferences = humanMessage.references ?? [];
          const humanAttachments = getVisibleHumanAttachments(
            [
              ...(humanMessage.fileAssets ?? []),
              ...(humanMessage.attachments ?? []),
            ],
            humanReferences,
          );
          const humanRuntimeCapabilityOptions = isHumanMessage
            ? (humanMessage.runtimeCapabilityOptions ??
              getRuntimeCapabilityOptionsForSelection(
                getRecommendedRuntimeCapabilitiesSelection(
                  humanMessage.runtimeCapabilities,
                ),
                runtimeCapabilityOptions,
              ))
            : [];
          const hasHumanAttachments =
            isHumanMessage && humanAttachments.length > 0;
          const isEditingMessage =
            Boolean(message.id) && editing?.messageId === message.id;
          const canEditMessage =
            isHumanMessage &&
            editing?.enabled &&
            Boolean(message.id) &&
            humanMessage.inputCheckpoint !== null &&
            !humanMessage.followUpMode;
          const canQuoteMessage =
            enableQuotes && (isHumanMessage || isAssistantMessage);
          const quoteSource = isHumanMessage
            ? t('chat.youLabel')
            : (assistantActor?.name ?? assistantTitle);
          const messageNavigationId = getMessageNavigationItemId(
            message as MessageNavigationSourceMessage,
            index,
          );

          if (
            !isAssistantMessage &&
            !hasPlainRenderableContent &&
            !hasHumanAttachments &&
            humanRuntimeCapabilityOptions.length === 0 &&
            humanReferences.length === 0
          ) {
            return null;
          }

          return (
            <div
              key={message.id ?? `${message.type}-${index}`}
              ref={(node) => {
                onMessageAnchor?.(messageNavigationId, node);
                processIndexes?.forEach((processIndex) =>
                  onMessageAnchor?.(
                    getMessageNavigationItemId(
                      messages[processIndex],
                      processIndex,
                    ),
                    node,
                  ),
                );
              }}
              data-message-navigation-id={messageNavigationId}
              data-actor-id={
                context?.actor.id ??
                (isHumanMessage
                  ? 'self'
                  : isAssistantMessage
                    ? assistantActor?.id
                    : undefined)
              }
              data-author={context?.actor.id}
              data-message-group-start={context ? !continuesGroup : undefined}
              data-message-group-end={context ? endsGroup : undefined}
              style={
                context
                  ? { marginTop: index === 0 ? 0 : continuesGroup ? 6 : 20 }
                  : undefined
              }
              id={context ? `group-message-${message.id}` : undefined}
              data-execution-id={
                'executionId' in message ? message.executionId : undefined
              }
              className={cn(
                'group group/message',
                context
                  ? isSelf
                    ? 'grid grid-cols-1 gap-x-3'
                    : 'grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3'
                  : 'flex gap-3',
                isSelf
                  ? 'justify-end'
                  : embedded
                    ? 'justify-start'
                    : 'justify-start -ml-1',
              )}
            >
              {context && !isSelf && (
                <div
                  data-slot="message-avatar-column"
                  className={cn(
                    'col-start-1 row-start-1 flex w-8 shrink-0 self-stretch items-end',
                    isAssistantMessage && 'mb-1',
                  )}
                >
                  {endsGroup && !context.streaming && (
                    <ChatkitAvatar
                      label={context.actor.name ?? ''}
                      avatar={context.actor.avatar}
                      className="size-8 shrink-0"
                    />
                  )}
                </div>
              )}
              <div
                className={cn(
                  'flex flex-col',
                  context &&
                    (isSelf
                      ? 'col-start-1 row-start-1 justify-self-end'
                      : 'col-start-2 row-start-1'),
                  !bubbles && 'overflow-hidden',
                  bubbles &&
                    isHumanMessage &&
                    'min-w-0 max-w-[92%] sm:max-w-[80%]',
                  !embedded && !context && 'px-3',
                  (isAssistantMessage || isEditingMessage) && 'min-w-0 flex-1',
                )}
              >
                {context && !isSelf && !continuesGroup && (
                  <div
                    className={cn(
                      'mb-1.5 flex items-center gap-2 text-xs text-muted-foreground',
                      isSelf && 'justify-end',
                    )}
                  >
                    {context.actorAction ? (
                      <button
                        type="button"
                        data-slot="message-sender-name"
                        className="truncate rounded-sm text-left font-medium hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title={context.actorAction.title}
                        onClick={context.actorAction.onClick}
                      >
                        {context.actor.name}
                      </button>
                    ) : (
                      <span
                        data-slot="message-sender-name"
                        className="truncate font-medium"
                      >
                        {context.actor.name}
                      </span>
                    )}
                  </div>
                )}
                {context?.before}
                {isEditingMessage && editing ? (
                  <MessageEditor
                    key={message.id}
                    initialText={messageContent}
                    onCancel={editing.onCancel}
                    onSave={(text) => editing.onSave(humanMessage, text)}
                  />
                ) : (
                  <>
                    <div
                      data-human-bubble={isHumanMessage ? '' : undefined}
                      data-system-bubble={
                        message.type === 'system' ? '' : undefined
                      }
                      {...(canQuoteMessage
                        ? {
                            'data-quote-message-id': message.id,
                            'data-quote-source': quoteSource,
                          }
                        : {})}
                      className={cn(
                        'max-w-full rounded-2xl',
                        context && isHumanMessage && 'whitespace-pre-wrap',
                        isHumanMessage
                          ? isSelf
                            ? 'bg-primary text-primary-foreground px-4 py-2.5'
                            : 'bg-muted text-foreground px-4 py-2.5'
                          : message.type === 'system'
                            ? 'bg-muted text-muted-foreground text-xs px-4 py-2.5'
                            : 'py-1 text-chat-foreground', // AI messages: use chat-specific foreground color
                      )}
                    >
                      {isAssistantMessage ? (
                        <AssistantMessage
                          mode={mode}
                          collapseProcess={collapseProcess}
                          processPrefix={
                            processIndexes?.length ? (
                              <MessageList
                                messages={processIndexes.map(
                                  (processIndex) => messages[processIndex],
                                )}
                                lookupMessages={
                                  (lookupMessages ??
                                    messages) as ChatkitMessage[]
                                }
                                assistantTitle={assistantTitle}
                                organizationId={organizationId}
                                apiUrl={apiUrl}
                                mcpApps={mcpApps}
                                enableQuotes={enableQuotes}
                                showActions={false}
                                embedded
                              />
                            ) : undefined
                          }
                          message={{
                            ...(message as ChatkitMessage),
                            type: 'assistant',
                          }}
                          messages={(
                            lookupMessages ?? messages.slice(0, index + 1)
                          ).map(
                            (item) =>
                              ({
                                ...(item as ChatkitMessage),
                                type:
                                  String(item.type) === 'ai'
                                    ? 'assistant'
                                    : item.type,
                              }) as ChatkitMessage,
                          )}
                          isStreaming={isStreamingMessage}
                          streamingStatus={streamingStatus}
                          showStreamingIndicator={!context}
                          isThreadRunning={isThreadRunning}
                          isThreadPaused={isThreadPaused}
                          organizationId={organizationId}
                          apiUrl={apiUrl}
                          pet={pet}
                          mcpApps={mcpApps}
                        />
                      ) : (
                        <>
                          {isHumanMessage &&
                            humanRuntimeCapabilityOptions.length > 0 && (
                              <HumanRuntimeCapabilityChips
                                options={humanRuntimeCapabilityOptions}
                              />
                            )}
                          {isHumanMessage && humanReferences.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {humanReferences.map((reference) => (
                                <ReferenceChip
                                  key={getReferenceKey(reference)}
                                  reference={reference}
                                  variant="message"
                                />
                              ))}
                            </div>
                          )}
                          {/* Show attachments for human messages */}
                          {isHumanMessage && humanAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {humanAttachments.map((file, fileIndex) => (
                                <div
                                  key={fileIndex}
                                  className="flex items-center gap-1.5 rounded-md bg-primary-foreground/20 px-2 py-1 text-xs"
                                >
                                  <FileText size={12} />
                                  <span className="max-w-[100px] truncate">
                                    {file.originalName ?? file.id}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {Array.isArray(message.content) ? (
                            message.content.map((part, partIndex) => (
                              <p
                                key={`${part.type}-${partIndex}`}
                                className="wrap-break-word text-sm leading-relaxed"
                              >
                                {formatMessageContent(part)}
                              </p>
                            ))
                          ) : (
                            <span className="wrap-break-word text-sm leading-relaxed">
                              {formatMessageContent(message.content)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {/* Message actions - hidden during streaming, retry only for last AI message */}
                    {showActions && (
                      <MessageActions
                        updatedAt={
                          isAssistantMessage || isHumanMessage
                            ? message.updatedAt
                            : undefined
                        }
                        content={
                          bubbles && isAssistantMessage
                            ? getMessageBubbleText(message as ChatkitMessage)
                            : collapseProcess && isAssistantMessage
                              ? (getFinalAnswerText(
                                  message as AssistantMessageWithAgentRuns,
                                ) ?? messageContent)
                              : messageContent
                        }
                        isAssistant={isAssistantMessage}
                        skillUsages={
                          isAssistantMessage
                            ? mergeChatSkillUsages(
                                ...(processIndexes ?? []).map((i) =>
                                  getMessageSkillUsages(messages[i]),
                                ),
                                getMessageSkillUsages(message),
                              )
                            : undefined
                        }
                        isStreaming={isStreamingMessage}
                        alwaysVisible={
                          isAssistantMessage && index === lastAssistantIndex
                        }
                        onActionTooltipOpen={onMessageActionTooltipOpen}
                        branching={(message as ChatkitMessage).branching}
                        isBranching={branchingMessageId === message.id}
                        branchDisabled={Boolean(branchingMessageId)}
                        onBranch={
                          onBranch && message.id
                            ? () => onBranch(message.id!)
                            : undefined
                        }
                        onEdit={
                          canEditMessage && editing
                            ? () => editing.onStart(message.id!)
                            : undefined
                        }
                        onRetry={
                          onRetry &&
                          isAssistantMessage &&
                          !isLoading &&
                          index === messages.length - 1
                            ? () => onRetry(index)
                            : undefined
                        }
                      />
                    )}
                    {index === approvalIndex && approval && (
                      <MessageBubble mode={mode}>{approval}</MessageBubble>
                    )}
                    {!context &&
                      !showActions &&
                      !isStreamingMessage &&
                      (isAssistantMessage || isHumanMessage) && (
                        <MessageTimestamp updatedAt={message.updatedAt} />
                      )}
                  </>
                )}
              </div>
              {context?.after && !isEditingMessage && (
                <div data-slot="message-footer" className="col-span-full">
                  {context.after}
                </div>
              )}
            </div>
          );
        })}
        {approvalIndex < 0 && approval && (
          <MessageBubble mode={mode}>{approval}</MessageBubble>
        )}
        {/* Show loading indicator with minimum display time */}
        {showLoadingDots &&
          (() => {
            const lastMessage = messages[messages.length - 1];
            const lastMessageType = lastMessage ? String(lastMessage.type) : '';
            const isLastMessageFromAI =
              lastMessageType === 'ai' || lastMessageType === 'assistant';
            const lastAssistantStatus = isLastMessageFromAI
              ? getAssistantStreamingStatus(
                  {
                    ...(lastMessage as ChatkitMessage),
                    lastStreamOutputAt,
                  },
                  isLoading,
                  { now: streamingNow },
                )
              : null;
            if (lastAssistantStatus) return null;
            const fallbackStreamingStatus = getAssistantStreamingStatus(
              {
                status: undefined,
                reasoning: undefined,
                lastStreamOutputAt,
              },
              isLoading,
              { now: streamingNow },
            );
            return (
              <div className="flex justify-start gap-3 -ml-2">
                <MessageBubble
                  mode={mode}
                  kind="status"
                  className="max-w-full py-2.5"
                >
                  <AssistantStreamingIndicator
                    status={fallbackStreamingStatus ?? 'loading'}
                  />
                </MessageBubble>
              </div>
            );
          })()}
      </div>
    </PresentationScrollAnchor>
  );
}
