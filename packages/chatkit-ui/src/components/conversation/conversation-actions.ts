import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';
import type { ThreadItem } from '../../hooks/useThreads';
import type { ChatKitAIMessage } from '../../providers/stream/types';
import { supportsConversationSharing } from '../sharing/share-client';

export type ConversationActionContext = {
  client: Client;
  /** Changes with the authorized runtime and selected thread; closes stale menus. */
  scopeKey: string;
  ready: boolean;
  activeConversationId: string | null;
  activeThreadId: string | null;
  running: boolean;
  history?: ChatKitOptions['history'];
  branchEnabled: boolean;
  rename: (target: ThreadItem, title: string) => Promise<unknown>;
  delete: (target: ThreadItem) => Promise<void>;
  navigate: (conversation: ChatConversation) => void;
  sideChat?: () => Promise<void>;
};

export type ConversationActionAvailability = {
  visible: boolean;
  disabled: boolean;
  reason?: 'loading' | 'unavailable' | 'running';
};

/** Both entry points use this policy. The API remains the authority for access. */
export function getConversationActions(
  context: ConversationActionContext,
  target: ThreadItem,
  detail: ChatConversation | null,
  messages: ChatKitAIMessage[] | null,
  busy = false,
) {
  const api = context.client.conversations;
  const readable = typeof api?.get === 'function';
  const active =
    target.recordId === context.activeConversationId &&
    target.id === context.activeThreadId;
  const ready = context.ready && detail?.id === target.recordId;
  const running =
    detail?.status === 'busy' ||
    detail?.status === 'pausing' ||
    (active && context.running);
  const replies = (messages ?? []).filter(
    (message) =>
      message.type === 'ai' &&
      message.id &&
      message.branching?.available === true,
  );
  const availability = (
    supported: boolean,
    needsMessages = false,
    needsIdle = false,
  ): ConversationActionAvailability => ({
    visible: readable && supported,
    disabled:
      !ready || busy || (needsMessages && !messages) || (needsIdle && running),
    reason: !context.ready
      ? 'unavailable'
      : !detail || busy || (needsMessages && !messages)
        ? 'loading'
        : needsIdle && running
          ? 'running'
          : undefined,
  });
  return {
    rename: availability(
      context.history?.showRename !== false &&
        typeof api?.update === 'function',
    ),
    delete: availability(
      context.history?.showDelete !== false &&
        typeof api?.delete === 'function',
      false,
      true,
    ),
    share: availability(
      supportsConversationSharing(context.client) &&
        !(detail ? detail.projectId : target.projectId),
      false,
      true,
    ),
    branch: availability(
      context.branchEnabled &&
        typeof api?.branch === 'function' &&
        replies.length > 0,
      true,
    ),
    sideChat: availability(
      active &&
        !!context.sideChat &&
        typeof context.client.threads?.copy === 'function' &&
        replies.length > 0,
      true,
    ),
    export: availability(typeof api?.searchMessages === 'function', true, true),
    replies,
  };
}

export function activeConversationTarget(
  context: Pick<
    ConversationActionContext,
    'activeConversationId' | 'activeThreadId' | 'running'
  >,
  known: ThreadItem | undefined,
  conversation: ChatConversation | null | undefined,
  title: string,
  projectId?: string,
): ThreadItem | null {
  if (!context.activeConversationId || !context.activeThreadId) return null;
  return {
    ...known,
    recordId: context.activeConversationId,
    // A conversation record can point at its original thread while a secondary branch is open.
    id: context.activeThreadId,
    title: known?.title || conversation?.title || title,
    projectId: conversation
      ? (conversation.projectId ?? null)
      : (known?.projectId ?? projectId ?? null),
    status: context.running
      ? 'busy'
      : (known?.status ?? conversation?.status ?? 'idle'),
  };
}
