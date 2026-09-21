import type { Message } from '@xpert-ai/xpert-sdk';
import type { StateType } from '../../providers/Stream';
import type {
  ChatKitOptions,
  ChatkitMessage,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
} from '@xpert-ai/chatkit-types';
import { FileText } from 'lucide-react';
import type { AssistantMessageWithAgentRuns } from '../../lib/agent-run-render-tree';
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
  messages: TranscriptMessage[];
  /** Original conversation for tool-result and interactive component lookups. */
  lookupMessages?: ChatkitMessage[];
  assistantTitle?: string;
  isLoading?: boolean;
  isThreadRunning?: boolean;
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
  onMessageAnchor?: (id: string, node: HTMLDivElement | null) => void;
  enableQuotes?: boolean;
};

/** Shared transcript presentation for main chat and read-only workbench views. */
export function MessageList({
  messages,
  lookupMessages,
  assistantTitle,
  isLoading = false,
  isThreadRunning,
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
  onMessageAnchor,
  enableQuotes = true,
}: MessageListProps) {
  const { t } = useChatkitTranslation();
  return (
    <div data-slot="chatkit-message-list" className="space-y-4">
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
        const messageType = String(message.type);
        const isHumanMessage =
          messageType === 'human' || messageType === 'user';
        const isAssistantMessage =
          messageType === 'assistant' || messageType === 'ai';
        const isStreamingMessage = isLoading && index === messages.length - 1;
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
          !streamingStatus
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
        const canQuoteMessage =
          enableQuotes && (isHumanMessage || isAssistantMessage);
        const quoteSource = isHumanMessage
          ? t('chat.youLabel')
          : assistantTitle;
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
            ref={(node) => onMessageAnchor?.(messageNavigationId, node)}
            data-message-navigation-id={messageNavigationId}
            className={cn(
              'group flex gap-3',
              isHumanMessage ? 'justify-end' : 'justify-start -ml-1', // AI messages: slightly closer to left
            )}
          >
            <div
              className={cn(
                'flex flex-col px-3 overflow-hidden',
                isAssistantMessage && 'min-w-0 flex-1',
              )}
            >
              <div
                {...(canQuoteMessage
                  ? {
                      'data-quote-message-id': message.id,
                      'data-quote-source': quoteSource,
                    }
                  : {})}
                className={cn(
                  'max-w-full rounded-2xl',
                  isHumanMessage
                    ? 'bg-primary text-primary-foreground px-4 py-2.5'
                    : message.type === 'system'
                      ? 'bg-muted text-muted-foreground text-xs px-4 py-2.5'
                      : 'py-1 text-chat-foreground', // AI messages: use chat-specific foreground color
                )}
              >
                {isAssistantMessage ? (
                  <AssistantMessage
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
                    isThreadRunning={isThreadRunning}
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
              <MessageActions
                content={messageContent}
                isAssistant={isAssistantMessage}
                isStreaming={isStreamingMessage}
                onRetry={
                  onRetry &&
                  isAssistantMessage &&
                  !isLoading &&
                  index === messages.length - 1
                    ? () => onRetry(index)
                    : undefined
                }
              />
            </div>
          </div>
        );
      })}
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
              <div className="max-w-full rounded-2xl py-2.5">
                <AssistantStreamingIndicator
                  status={fallbackStreamingStatus ?? 'loading'}
                />
              </div>
            </div>
          );
        })()}
    </div>
  );
}
