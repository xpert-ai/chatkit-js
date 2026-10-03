import { useCallback } from 'react';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import type { useStreamHistoryMessages } from '../history/useStreamHistoryMessages';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamScope } from '../scope/useStreamScope';
import type { useStreamTransport } from '../transport/useStreamTransport';
import type { useStreamRunState } from './useStreamRunState';

type StreamResumeOptions = Pick<
  ReturnType<typeof useStreamRunState>,
  | 'pausedDisplayRef'
  | 'pauseRequestedRef'
  | 'setPausedDisplay'
  | 'rememberActiveRunId'
  | 'lastEventIdRef'
  | 'setError'
> &
  Pick<
    ReturnType<typeof useStreamScope>,
    'conversationIdRef' | 'activeThreadIdRef' | 'threadId'
  > &
  Pick<
    ReturnType<typeof useStreamHistoryMessages>,
    'reconcileLatestAssistantMessage'
  > &
  Pick<ReturnType<typeof useStreamCredentials>, 'client'> &
  Pick<ReturnType<typeof useStreamMessages>, 'setValues'> &
  Pick<ReturnType<typeof useStreamTransport>, 'runStream'>;

export function useStreamResume({
  pausedDisplayRef,
  conversationIdRef,
  reconcileLatestAssistantMessage,
  activeThreadIdRef,
  client,
  pauseRequestedRef,
  setPausedDisplay,
  threadId,
  setValues,
  rememberActiveRunId,
  lastEventIdRef,
  runStream,
  setError,
}: StreamResumeOptions) {
  const resumeDisplay = useCallback(async () => {
    const display = pausedDisplayRef.current;
    if (!display?.pause) return;
    const recordId = conversationIdRef.current;
    if (recordId) {
      const refreshed = await reconcileLatestAssistantMessage(
        recordId,
        display.threadId,
        new AbortController().signal,
      );
      if (
        pausedDisplayRef.current !== display ||
        activeThreadIdRef.current !== display.threadId
      )
        return;
      if (!refreshed)
        throw new Error('Failed to load the completed response. Please retry.');
    }
    await client.threads.releaseDisplayPause(
      display.threadId,
      display.pause.pauseId,
    );
    if (
      pausedDisplayRef.current === display &&
      activeThreadIdRef.current === display.threadId
    ) {
      pauseRequestedRef.current = false;
      setPausedDisplay(null);
    }
  }, [client, setPausedDisplay, reconcileLatestAssistantMessage]);

  const resumeRun = useCallback(
    async (runId: string, pauseId: string) => {
      const target = activeThreadIdRef.current ?? threadId;
      if (!target) return;
      const run = await client.runs.resume(target, runId, pauseId);
      if (activeThreadIdRef.current !== target) return;
      pauseRequestedRef.current = false;
      setValues((previous) => ({
        ...previous,
        messages: previous.messages.map((message) =>
          message.executionId === runId
            ? {
                ...message,
                rootExecutionIds: [
                  ...new Set([
                    ...(message.rootExecutionIds ?? []),
                    runId,
                    run.run_id,
                  ]),
                ],
              }
            : message,
        ),
      }));
      setPausedDisplay(null);
      rememberActiveRunId(run.run_id);
      lastEventIdRef.current = null;
      void runStream(
        target,
        null,
        { joinExistingThread: true },
        run.run_id,
      ).catch(setError);
    },
    [client, rememberActiveRunId, runStream, threadId],
  );
  return { resumeDisplay, resumeRun };
}
