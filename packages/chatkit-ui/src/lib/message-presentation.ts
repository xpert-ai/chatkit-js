import {
  REQUEST_USER_INPUT_RESULT_TYPE,
  REQUEST_USER_INPUT_TOOL_NAME,
  type ChatKitMessagePresentationOptions,
  type ChatkitMessage,
  type TMessageContentComplex,
} from '@xpert-ai/chatkit-types';
import type { ChatkitAvatarData } from '../components/ui/chatkit-avatar';
import { isNonTranscriptMessageContent } from './message-content-presentation';
import {
  buildAssistantRenderTree,
  type AssistantMessageWithAgentRuns,
} from './agent-run-render-tree';

export type MessagePresentationMode = NonNullable<
  ChatKitMessagePresentationOptions['mode']
>;

export function resolveMessagePresentation(
  options?: ChatKitMessagePresentationOptions,
  assistantDefaults?: ChatKitMessagePresentationOptions,
) {
  const mode = options?.mode ?? assistantDefaults?.mode ?? 'transcript';
  return {
    mode,
    collapseProcess:
      mode === 'transcript' &&
      (options?.collapseProcess ?? assistantDefaults?.collapseProcess ?? false),
  };
}

/** Presentation identity is independent of execution IDs and message roles. */
export type MessageActor = {
  id: string;
  kind: 'user' | 'assistant' | 'system' | 'unknown';
  name?: string;
  avatar?: ChatkitAvatarData | null;
};

export type PresentationSource = {
  messageId: string;
  blockId?: string;
  sourceIndex: number;
  executionId?: string;
};

export type BubbleContentKind =
  | 'text'
  | 'media'
  | 'rich'
  | 'process'
  | 'omitted';

export function getBubbleContentKind(
  content: TMessageContentComplex | string,
): BubbleContentKind {
  if (typeof content === 'string') return content.trim() ? 'text' : 'omitted';
  if (isNonTranscriptMessageContent(content)) return 'omitted';
  if (content.type === 'text') return content.text?.trim() ? 'text' : 'omitted';
  if (content.type === 'image_url') return 'media';
  if (content.type === 'reasoning' || content.type === 'memory')
    return 'process';
  if (content.type === 'agent_event') return 'process';
  if (content.type === 'component') {
    const data = content.data;
    if (
      data?.type === 'Widget' ||
      data?.type === 'McpApp' ||
      data?.type === REQUEST_USER_INPUT_RESULT_TYPE ||
      data?.tool === REQUEST_USER_INPUT_TOOL_NAME
    ) {
      return 'rich';
    }
    if (data?.category === 'Tool' || data?.type === 'context-compression')
      return 'process';
  }
  // Unknown components remain available through the existing renderer.
  return 'rich';
}

export function buildMessagePresentation(
  message: ChatkitMessage,
  actor?: MessageActor,
) {
  const content =
    typeof message.content === 'string' ? [message.content] : message.content;
  return content.map((item, sourceIndex) => {
    const blockId = typeof item === 'string' ? undefined : item.id;
    const source: PresentationSource = {
      messageId: message.id,
      sourceIndex,
      blockId,
      executionId: typeof item === 'string' ? undefined : item.executionId,
    };
    return {
      key: `${message.id}:content:${blockId ?? sourceIndex}`,
      source,
      actor,
      kind: getBubbleContentKind(item),
      content: item,
    };
  });
}

export function getMessageBubbleText(message: AssistantMessageWithAgentRuns) {
  // Child / external assistant cards own their reply. Do not copy their hidden
  // transcript into the parent's text or attribute it to the parent author.
  return buildAssistantRenderTree(message)
    .units.flatMap((unit) => {
      if (unit.type !== 'entry') return [];
      const item = unit.entry.item;
      if (typeof item === 'string') return item.trim() ? [item] : [];
      return item.type === 'text' && item.text?.trim()
        ? [item.text as string]
        : [];
    })
    .join('\n\n');
}

export function getBubbleCompletionStatus(status?: string) {
  switch (status?.toLowerCase()) {
    case 'success':
    case 'completed':
      return 'completed';
    case 'fail':
    case 'failed':
    case 'error':
    case 'timeout':
      return 'failed';
    case 'paused':
    case 'pausing':
    case 'pending':
      return 'paused';
    case 'aborted':
    case 'interrupted':
    case 'canceled':
    case 'cancelled':
      return 'interrupted';
    default:
      return null;
  }
}
