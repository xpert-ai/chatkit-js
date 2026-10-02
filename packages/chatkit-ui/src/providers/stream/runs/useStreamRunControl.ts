import { useCallback } from 'react';
import {
  parsePausedDisplaySnapshot,
  reconcilePausedDisplaySteps,
  serializePausedDisplaySnapshot,
} from '../../../lib/paused-display-snapshot';
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
  | 'setPausedDisplay'
  | 'pausedDisplayRef'
  | 'lastExecutionIdRef'
> &
  Pick<ReturnType<typeof useStreamUserInput>, 'clearPendingRequestUserInput'> &
  Pick<ReturnType<typeof useStreamInterrupts>, 'clearPendingHITLRequest'> &
  Pick<ReturnType<typeof useStreamScope>, 'activeThreadIdRef' | 'threadId'> &
  Pick<ReturnType<typeof useStreamMessages>, 'valuesRef' | 'setValues'> &
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
  valuesRef,
  setPausedDisplay,
  client,
  pausedDisplayRef,
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
      const display = { threadId: target, values: valuesRef.current };
      setPausedDisplay(display);
      try {
        const result = await client.runs.pause(target, runId, {
          displaySnapshot: serializePausedDisplaySnapshot(display.values),
        });
        if (!result.displayPause?.snapshot) {
          throw new Error(
            'The server did not save the paused display snapshot. Update the server before retrying.',
          );
        }
        if (
          pausedDisplayRef.current?.threadId === target &&
          activeThreadIdRef.current === target
        ) {
          // The snapshot is captured at click time, so a step that was already
          // running can settle while the server acknowledges the pause.
          setPausedDisplay({
            ...pausedDisplayRef.current,
            values: reconcilePausedDisplaySteps(
              parsePausedDisplaySnapshot(result.displayPause.snapshot),
              valuesRef.current,
            ),
            pause: result.displayPause,
          });
        }
      } catch (error) {
        if (activeThreadIdRef.current === target) {
          pauseRequestedRef.current = false;
          if (pausedDisplayRef.current?.threadId === target)
            setPausedDisplay(null);
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
