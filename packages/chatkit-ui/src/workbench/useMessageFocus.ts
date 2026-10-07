import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { HistoryMessagePaginationState } from '../providers/Stream';
import type {
  ChatKitMessageFocusRequest,
  ChatKitMessageFocusResult,
} from '@xpert-ai/chatkit-types';

export type MessageFocusRequest = ChatKitMessageFocusRequest;
type Pending = MessageFocusRequest & {
  startingThreadId: string | null | undefined;
  reachedTarget: boolean;
  resolve: (result: ChatKitMessageFocusResult) => void;
  timer: ReturnType<typeof setTimeout>;
};
type MessageFocusOptions = {
  scope: string;
  conversationId: string | null | undefined;
  threadId: string | null | undefined;
  history: HistoryMessagePaginationState | undefined;
  historyReady: boolean;
  historyError?: string;
  loadMore: () => Promise<unknown>;
  rootRef: RefObject<HTMLElement | null>;
  unavailableMessage: string;
};

/** Navigation reads persisted history; it never submits, resets or cancels a run. */
export function useMessageFocus(input: MessageFocusOptions) {
  const pending = useRef<Pending | null>(null);
  const latestThread = useRef(input.threadId);
  latestThread.current = input.threadId;
  const loading = useRef<Pending | null>(null);
  const page = useRef<string | null>(null);
  const highlight = useRef<HTMLElement | null>(null);
  const [revision, update] = useState(0);
  const finish = useCallback((result: ChatKitMessageFocusResult) => {
    const active = pending.current;
    pending.current = null;
    if (active) {
      clearTimeout(active.timer);
      active.resolve(result);
    }
  }, []);
  useEffect(
    () => () => {
      finish({ success: false, code: 'stale_context' });
      highlight.current?.removeAttribute('data-message-focused');
    },
    [input.scope, finish],
  );

  const focus = useCallback(
    (request: MessageFocusRequest) => {
      finish({ success: false, code: 'stale_context' });
      highlight.current?.removeAttribute('data-message-focused');
      page.current = null;
      return new Promise<ChatKitMessageFocusResult>((resolve) => {
        const timer = setTimeout(
          () => finish({ success: false, code: 'message_focus_timeout' }),
          25000,
        );
        pending.current = {
          ...request,
          resolve,
          timer,
          startingThreadId: latestThread.current,
          reachedTarget: false,
        };
        update((value) => value + 1);
      });
    },
    [finish],
  );

  useEffect(() => {
    const active = pending.current;
    if (
      active &&
      input.threadId &&
      input.threadId !== active.threadId &&
      (active.reachedTarget || input.threadId !== active.startingThreadId)
    ) {
      finish({ success: false, code: 'stale_context' });
      return;
    }
    if (
      !active ||
      active.threadId !== input.threadId ||
      active.conversationId !== input.conversationId
    )
      return;
    active.reachedTarget = true;
    if (input.historyError) {
      finish({
        success: false,
        code: 'message_load_failed',
        message: input.historyError,
      });
      return;
    }
    if (!input.historyReady || input.history?.threadId !== input.threadId)
      return;
    const anchor = Array.from(
      input.rootRef.current?.querySelectorAll<HTMLElement>(
        '[data-message-navigation-id], [data-message-id]',
      ) ?? [],
    ).find(
      (element) =>
        element.dataset.messageNavigationId === active.messageId ||
        element.dataset.messageId === active.messageId,
    );
    if (anchor) {
      anchor.scrollIntoView({ block: 'center', behavior: 'smooth' });
      anchor.setAttribute('data-message-focused', 'true');
      highlight.current = anchor;
      finish({ success: true, status: 'opened' });
      return;
    }
    if (input.history.isLoadingMore || loading.current) return;
    const pageKey = `${active.threadId}:${input.history.loadedCount}`;
    if (!input.history.hasMore || page.current === pageKey) {
      finish({
        success: false,
        code: 'message_unavailable',
        message: input.unavailableMessage,
      });
      return;
    }
    page.current = pageKey;
    loading.current = active;
    void input
      .loadMore()
      .catch((error: unknown) => {
        if (pending.current === active)
          finish({
            success: false,
            code: 'message_load_failed',
            message:
              error instanceof Error ? error.message : input.unavailableMessage,
          });
      })
      .finally(() => {
        loading.current = null;
        if (pending.current) update((value) => value + 1);
      });
  }, [input, revision, finish]);
  return focus;
}
