import { useCallback } from 'react';
import { interruptActiveAgentRunOnMessages } from '../../../lib/stream-agent-runs';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import type { useStreamInterrupts } from '../interrupts/useStreamInterrupts';
import type { useStreamUserInput } from '../interrupts/useStreamUserInput';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamScope } from '../scope/useStreamScope';
import { createAbortError } from '../transport/errors';
import type { useStreamRunState } from './useStreamRunState';

type StreamRunControlOptions = Pick<
  ReturnType<typeof useStreamRunState>,
  | 'abortRef'
  | 'setIsLoading'
  | 'setInterruptedThreadId'
  | 'isLoadingRef'
  | 'pauseRequestedRef'
  | 'lastExecutionIdRef'
> &
  Pick<ReturnType<typeof useStreamUserInput>, 'clearPendingRequestUserInput'> &
  Pick<ReturnType<typeof useStreamInterrupts>, 'clearPendingHITLRequest'> &
  Pick<ReturnType<typeof useStreamScope>, 'activeThreadIdRef' | 'threadId'> &
  Pick<ReturnType<typeof useStreamMessages>, 'setValues'> &
  Pick<ReturnType<typeof useStreamCredentials>, 'client'>;

export function useStreamRunControl({
  abortRef,
  clearPendingRequestUserInput,
  clearPendingHITLRequest,
  setIsLoading,
  setInterruptedThreadId,
  isLoadingRef,
  activeThreadIdRef,
  threadId,
  pauseRequestedRef,
  client,
  lastExecutionIdRef,
  setValues,
}: StreamRunControlOptions) {
  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearPendingRequestUserInput(
      createAbortError('The user input request was cancelled.'),
    );
    clearPendingHITLRequest(
      createAbortError('The HITL request was cancelled.'),
    );
    setIsLoading(false);
    setInterruptedThreadId(null);
    isLoadingRef.current = false;
  }, [clearPendingHITLRequest, clearPendingRequestUserInput]);

  const pauseRun = useCallback(
    async (runId: string) => {
      const target = activeThreadIdRef.current ?? threadId;
      if (!target) return;
      pauseRequestedRef.current = true;
      try {
        // Control requests never carry transcript, tool output, or image bytes.
        await client.runs.pause(target, runId, { pollTimeoutMs: 0 });
      } catch (error) {
        if (activeThreadIdRef.current === target) {
          // A lost response does not mean the durable request was rejected.
          const current = await client.threads.get(target).catch(() => null);
          if (activeThreadIdRef.current === target) {
            pauseRequestedRef.current =
              current === null ||
              current.status === 'pausing' ||
              current.status === 'paused';
            if (
              current?.runControl?.executionId === runId &&
              ['pausing', 'paused'].includes(current.status)
            )
              return;
          }
        }
        throw error;
      }
    },
    [client, threadId],
  );

  const stop = useCallback(() => {
    const activeThreadId = activeThreadIdRef.current ?? threadId ?? null;
    const activeRunId = lastExecutionIdRef.current;
    const hasActiveRun = abortRef.current !== null;
    disconnect();
    if (hasActiveRun) {
      const interruptedAt = Date.now();
      setValues((prev) => {
        const messages = prev.messages ?? [];
        const nextMessages = interruptActiveAgentRunOnMessages(messages, {
          activeRunId,
          hasActiveRun,
          interruptedAt,
        });
        return nextMessages === messages
          ? prev
          : { ...prev, messages: nextMessages };
      });
    }
    if (hasActiveRun && activeThreadId && activeRunId) {
      client.runs
        .cancel(activeThreadId, activeRunId, false)
        .catch(() => undefined);
    }
  }, [client, disconnect, threadId]);
  return { disconnect, stop, pauseRun };
}
