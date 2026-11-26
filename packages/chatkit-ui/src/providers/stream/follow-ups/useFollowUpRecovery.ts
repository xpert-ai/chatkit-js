import { useEffect, useRef } from 'react';
import { combineRequestSignals } from '../../../lib/request-abort';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import type { ReadRecovery } from '../connection/read-recovery';
import { waitForAbortableDelay } from '../history/reconciliation';
import { readFollowUpReceipts } from './reconcile';
import type { useStreamFollowUpState } from './useStreamFollowUpState';

type Options = Pick<ReturnType<typeof useStreamCredentials>, 'readClient'> &
  Pick<
    ReturnType<typeof useStreamFollowUpState>,
    | 'pendingFollowUps'
    | 'pendingFollowUpsRef'
    | 'flushSteerFollowUps'
    | 'removePendingFollowUps'
    | 'markPendingFollowUpsAsQueued'
  > & {
    recovery: ReadRecovery;
    conversationId: string | null;
    threadId: string | null;
    scopeKey: string;
    enabled: boolean;
  };

/** Receipts outlive a transport. Reads settle inputs or restore a queue entry
 * explicitly returned by the server; uncertainty never dispatches a command. */
export function useFollowUpRecovery(options: Options) {
  const current = useRef(options);
  current.current = options;
  const { readClient, recovery, conversationId, threadId, scopeKey, enabled } =
    options;
  const hasPending = options.pendingFollowUps.some(
    (item) => item.mode === 'steer',
  );
  useEffect(() => {
    if (!enabled || !hasPending || !conversationId || !threadId) return;
    const controller = new AbortController();
    const signal =
      combineRequestSignals([controller.signal, recovery.signal]) ??
      controller.signal;
    const key = `follow-ups:${conversationId}:${threadId}`;
    const isCurrent = () =>
      !signal.aborted &&
      current.current.enabled &&
      current.current.scopeKey === scopeKey &&
      current.current.conversationId === conversationId &&
      current.current.threadId === threadId;
    const reconcile = async () => {
      while (isCurrent() && !recovery.stopped) {
        const pending = current.current.pendingFollowUpsRef.current.filter(
          (item) => item.mode === 'steer',
        );
        if (!pending.length) return;
        try {
          const receipts = await recovery.read(
            key,
            (readSignal) =>
              readFollowUpReceipts(
                readClient.conversations,
                conversationId,
                threadId,
                pending,
                readSignal,
              ),
            signal,
          );
          if (!isCurrent()) return;
          for (const receipt of receipts.consumed) {
            current.current.flushSteerFollowUps(
              [receipt.id],
              receipt.visibleAt,
            );
          }
          current.current.removePendingFollowUps(receipts.canceled);
          current.current.markPendingFollowUpsAsQueued(receipts.queued, {
            autoDrain: true,
            queuedFromSteer: true,
          });
        } catch {
          // The shared coordinator applies backoff and reports unavailable reads.
          // A missing acknowledgement never authorizes sending the input again.
          if (!isCurrent() || recovery.stopped) return;
        }
        await waitForAbortableDelay(signal, 2_000);
      }
    };
    void reconcile();
    return () => {
      controller.abort();
      // Resolved inputs or navigation retire this read channel's transient error.
      recovery.succeeded(key);
    };
  }, [
    readClient,
    recovery,
    conversationId,
    threadId,
    scopeKey,
    enabled,
    hasPending,
  ]);
}
