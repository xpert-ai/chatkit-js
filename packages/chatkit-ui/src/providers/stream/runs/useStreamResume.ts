import { useCallback } from 'react';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamScope } from '../scope/useStreamScope';
import type { useStreamTransport } from '../transport/useStreamTransport';
import type { useStreamRunState } from './useStreamRunState';

type StreamResumeOptions = Pick<
  ReturnType<typeof useStreamRunState>,
  'pauseRequestedRef' | 'rememberActiveRunId' | 'lastEventIdRef' | 'setError'
> &
  Pick<ReturnType<typeof useStreamScope>, 'activeThreadIdRef' | 'threadId'> &
  Pick<ReturnType<typeof useStreamCredentials>, 'client'> &
  Pick<ReturnType<typeof useStreamMessages>, 'setValues'> &
  Pick<ReturnType<typeof useStreamTransport>, 'runStream'>;

export function useStreamResume({
  activeThreadIdRef,
  client,
  pauseRequestedRef,
  threadId,
  setValues,
  rememberActiveRunId,
  lastEventIdRef,
  runStream,
  setError,
}: StreamResumeOptions) {
  const resumeRun = useCallback(
    async (runId: string, pauseId: string) => {
      const target = activeThreadIdRef.current ?? threadId;
      if (!target) return;
      setError(null);
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

      rememberActiveRunId(run.run_id);
      lastEventIdRef.current = null;
      void runStream(
        target,
        null,
        { joinExistingThread: true },
        run.run_id,
      ).catch(setError);
    },
    [client, rememberActiveRunId, runStream, threadId, setError],
  );
  return { resumeRun };
}
