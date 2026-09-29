import { useEffect, useRef, useState, type RefObject } from 'react';
import type { HistoryMessagePaginationState } from '../providers/Stream';
import type { ExecutionNavigationResult } from './client-command-payload';

/** Locate the exact persisted attempt, loading older pages through the normal SDK path. */
export type ExecutionFocusOptions = {
  executionId: unknown;
  /** Unique per explicit navigation, so reopening the same attempt is allowed. */
  requestId?: unknown;
  requestedThread: unknown;
  threadId: string | null | undefined;
  scope: string;
  externalRuns: readonly { id: string }[];
  messages: readonly { executionId?: string }[];
  history: HistoryMessagePaginationState | undefined;
  historyReady: boolean;
  loadMore: () => Promise<unknown>;
  openExternal: (id: string) => void;
  rootRef: RefObject<HTMLElement | null>;
  onError: (message: string) => void;
  onComplete?: (result: ExecutionNavigationResult) => void;
  revealMessage?: () => void;
  unavailableMessage: string;
};

export function useExecutionFocus(input: ExecutionFocusOptions) {
  const handled = useRef<string | null>(null);
  const pending = useRef<string | null>(null);
  const currentKey = useRef<string | null>(null);
  const requestedPage = useRef<string | null>(null);
  const [pageRevision, setPageRevision] = useState(0);
  const key =
    typeof input.executionId === 'string' &&
    input.requestedThread === input.threadId
      ? JSON.stringify([
          input.scope,
          input.executionId,
          typeof input.requestId === 'string' ? input.requestId : null,
        ])
      : null;
  currentKey.current = key;

  useEffect(() => {
    if (!key) {
      handled.current = null;
      requestedPage.current = null;
      return;
    }
    if (typeof input.executionId !== 'string' || handled.current === key)
      return;
    if (input.externalRuns.some((run) => run.id === input.executionId)) {
      handled.current = key;
      input.openExternal(input.executionId);
      input.onComplete?.({ success: true, status: 'opened' });
      return;
    }
    if (
      input.messages.some(
        (message) => message.executionId === input.executionId,
      )
    ) {
      input.revealMessage?.();
      // Query only rendered anchors; don't interpolate an untrusted selector.
      const element = Array.from(
        input.rootRef.current?.querySelectorAll<HTMLElement>(
          '[data-execution-id]',
        ) ?? [],
      ).find((item) => item.dataset.executionId === input.executionId);
      if (element) {
        element.scrollIntoView({ block: 'center' });
        handled.current = key;
        input.onComplete?.({ success: true, status: 'opened' });
      }
      return;
    }
    const history = input.history;
    if (
      !history ||
      !input.historyReady ||
      history.threadId !== input.threadId ||
      history.isLoadingMore ||
      pending.current
    )
      return;
    if (!history.hasMore) {
      // Pagination can have the target scope before initial hydration completes.
      handled.current = key;
      input.onError(input.unavailableMessage);
      input.onComplete?.({
        success: false,
        code: 'execution_unavailable',
        message: input.unavailableMessage,
      });
      return;
    }
    const pageKey = `${key}:${history.loadedCount}`;
    if (requestedPage.current === pageKey) {
      handled.current = key;
      input.onError(input.unavailableMessage);
      input.onComplete?.({
        success: false,
        code: 'execution_unavailable',
        message: input.unavailableMessage,
      });
      return;
    }
    requestedPage.current = pageKey;
    pending.current = key;
    void input
      .loadMore()
      .catch((error: unknown) => {
        if (currentKey.current !== key) return;
        handled.current = key;
        const message = error instanceof Error ? error.message : String(error);
        input.onError(message);
        input.onComplete?.({
          success: false,
          code: 'execution_load_failed',
          message,
        });
      })
      .finally(() => {
        pending.current = null;
        if (currentKey.current) setPageRevision((value) => value + 1);
      });
  }, [key, input, pageRevision]);
}
