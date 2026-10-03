import { isComponentContent } from './assistant-blocks';
import * as React from 'react';
import type { ChatKitOptions, ChatkitMessage } from '@xpert-ai/chatkit-types';
import { Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import {
  type AssistantStreamingStatus,
  getAssistantStreamingStatus,
  hasRenderableFileActivity,
  hasRenderableMessageContent,
  hasRenderableReasoning,
} from '../../../lib/message';
import {
  buildAssistantRenderTree,
  type AssistantMessageWithAgentRuns,
} from '../../../lib/agent-run-render-tree';
import {
  getBubbleCompletionStatus,
  getBubbleContentKind,
  type MessagePresentationMode,
} from '../../../lib/message-presentation';
import { cn } from '../../../lib/utils';
import { InlinePetStatus } from '../../pet/InlinePetStatus';
import { useWorkbench } from '../../../workbench/context';
import { MessageFileActivity } from '../../task-summary/FileActivity';
import { MessageResourceCards, messageResourceCards } from './resource-cards';
import { AssistantContent } from './assistant-content';
import { MessageBubble } from './message-bubble';
import { hasBubbleToolResult } from './bubble-tool-results';
import { getRequestUserInputResultCardData } from './request-user-input-result-card';

export type AssistantMessageProps = {
  mode?: MessagePresentationMode;
  collapseProcess?: boolean;
  processPrefix?: React.ReactNode;
  message: ChatkitMessage & { type: 'assistant' };
  messages?: ChatkitMessage[];
  className?: string;
  isStreaming?: boolean;
  streamingStatus?: AssistantStreamingStatus | null;
  isThreadRunning?: boolean;
  isThreadPaused?: boolean;
  organizationId?: string;
  apiUrl?: string;
  pet?: ChatKitOptions['pet'] | null;
  mcpApps?: ChatKitOptions['mcpApps'];
};

export function AssistantStreamingIndicator({
  status,
  className,
}: {
  status: AssistantStreamingStatus;
  className?: string;
}) {
  const { t } = useChatkitTranslation();
  const labelMap: Record<AssistantStreamingStatus, string> = {
    loading: t('message.thinking'),
    thinking: t('message.thinking'),
    answering: t('message.answering'),
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground',
        className,
      )}
    >
      {status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {status === 'thinking' && (
        <div className="flex items-end gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
        </div>
      )}
      {status === 'answering' && (
        <div className="flex items-end gap-1" aria-hidden="true">
          <span className="h-2 w-0.5 rounded-full bg-current animate-pulse [animation-delay:-0.25s]" />
          <span className="h-3 w-0.5 rounded-full bg-current animate-pulse [animation-delay:-0.1s]" />
          <span className="h-2.5 w-0.5 rounded-full bg-current animate-pulse" />
        </div>
      )}
      <span>{labelMap[status]}</span>
    </div>
  );
}

export function AssistantMessage({
  mode = 'transcript',
  collapseProcess,
  processPrefix,
  message,
  messages,
  className,
  isStreaming = false,
  streamingStatus,
  isThreadRunning,
  isThreadPaused,
  organizationId,
  apiUrl,
  pet,
  mcpApps,
}: AssistantMessageProps) {
  const workbench = useWorkbench();
  const renderTree = buildAssistantRenderTree(
    message as AssistantMessageWithAgentRuns,
  );
  const rootReasoning = renderTree.hasAgentRuns
    ? renderTree.rootReasoning
    : message.reasoning;
  const hasContent =
    hasRenderableMessageContent(message.content) ||
    renderTree.hasAgentRuns ||
    hasRenderableFileActivity(message) ||
    messageResourceCards(message).length > 0;
  const hasReasoning = hasRenderableReasoning(rootReasoning);
  const resolvedStreamingStatus =
    streamingStatus ?? getAssistantStreamingStatus(message, isStreaming);
  // An idle answer can report "thinking" without starting another reasoning phase.
  const isReasoning =
    isStreaming &&
    message.status !== 'answering' &&
    resolvedStreamingStatus === 'thinking';
  const lookupMessages = messages?.length ? messages : [message];
  const inlinePetState = resolvedStreamingStatus
    ? resolvedStreamingStatus === 'loading'
      ? ('running' as const)
      : ('review' as const)
    : null;
  const inlinePet = inlinePetState ? (
    <InlinePetStatus pet={pet} state={inlinePetState} />
  ) : null;

  const contentOptions = {
    mode,
    collapseProcess,
    processPrefix,
    isStreaming,
    onOpenExternalAssistant:
      workbench.externalAssistantsEnabled && !message.historical
        ? workbench.openExternalAssistant
        : undefined,
    isReasoning,
    isThreadRunning,
    isThreadPaused,
    organizationId,
    apiUrl,
    mcpApps,
  };
  const answerNode = (
    <AssistantContent
      message={message}
      lookupMessages={lookupMessages}
      options={contentOptions}
    />
  );

  const { t } = useChatkitTranslation();
  const bubbles = mode === 'bubbles';
  const hasBubbleContent =
    renderTree.units.some((unit) => {
      if (unit.type === 'agent') return true;
      const item = unit.entry.item;
      const kind = getBubbleContentKind(item);
      return (
        ['text', 'rich', 'media'].includes(kind) ||
        (typeof item !== 'string' &&
          isComponentContent(item) &&
          (hasBubbleToolResult(item) ||
            Boolean(getRequestUserInputResultCardData(item, lookupMessages))))
      );
    }) ||
    hasRenderableFileActivity(message) ||
    messageResourceCards(message).length > 0;
  const completion = getBubbleCompletionStatus(message.status);
  const showCompletion =
    bubbles &&
    !resolvedStreamingStatus &&
    (completion === 'failed' ||
      completion === 'paused' ||
      completion === 'interrupted' ||
      (!hasBubbleContent && completion));

  if (
    !hasContent &&
    !hasReasoning &&
    !resolvedStreamingStatus &&
    !showCompletion
  )
    return null;

  // Streaming class for smooth animation effect
  const streamingClass = isStreaming ? 'streaming-active' : '';

  return (
    <div className={cn('space-y-3', streamingClass, className)}>
      {answerNode}
      {!isStreaming && (
        <>
          <MessageBubble
            mode={mode}
            hidden={!hasRenderableFileActivity(message)}
          >
            <MessageFileActivity message={message} />
          </MessageBubble>
          <MessageResourceCards message={message} mode={mode} />
        </>
      )}
      {showCompletion && (
        <MessageBubble mode={mode} kind="status" role="status">
          {t(`message.bubbles.${completion}`)}
        </MessageBubble>
      )}
      {resolvedStreamingStatus ? (
        <MessageBubble
          mode={mode}
          kind="status"
          className="flex items-center gap-2"
        >
          {inlinePet}
          <AssistantStreamingIndicator status={resolvedStreamingStatus} />
        </MessageBubble>
      ) : null}
    </div>
  );
}
