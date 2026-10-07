import * as React from 'react';
import type { useChatBranchState } from './useChatBranchState';
import type { useChatEnvironment } from './useChatEnvironment';

type ChatRunControlOptions = Pick<
  ReturnType<typeof useChatBranchState>,
  'isChangingBranch' | 'activeBranchRef'
> & {
  branchState: Pick<ReturnType<typeof useChatBranchState>['branchState'], 'current' | 'refresh'>;
  stream: Pick<ReturnType<typeof useChatEnvironment>['stream'],
    'threadId' | 'isLoading' | 'activeRunId' | 'isThreadInterrupted' | 'stop' | 'pauseRun' | 'resumeRun'>;
};

export function useChatRunControl({
  branchState,
  stream,
  isChangingBranch,
  activeBranchRef,
}: ChatRunControlOptions) {
  const [runControlRequest, setRunControlRequest] = React.useState<{
    action: 'pause' | 'resume' | 'stop';
    threadId: string;
    runId: string;
  } | null>(null);

  const runControlRequestRef = React.useRef<typeof runControlRequest>(null);
  const [runControlError, setRunControlError] = React.useState<{
    threadId: string;
    message: string;
  } | null>(null);

  const errorGenerationRef = React.useRef(0);
  const clearRunControlError = React.useCallback(() => {
    errorGenerationRef.current += 1;
    setRunControlError(null);
  }, []);
  React.useEffect(clearRunControlError, [stream.threadId, clearRunControlError]);

  const currentRunControl = branchState.current?.runControl;
  const pauseRunId = stream.isLoading
    ? stream.activeRunId ?? currentRunControl?.executionId ?? null
    : currentRunControl?.executionId ?? stream.activeRunId ?? null;

  const canPauseRun = Boolean(
    stream.threadId &&
    pauseRunId &&
    !stream.isThreadInterrupted &&
    (stream.isLoading || currentRunControl?.state === 'running'),
  );

  const isRunPausing =
    (runControlRequest?.threadId === stream.threadId &&
      runControlRequest.action === 'pause') ||
    branchState.current?.status === 'pausing';

  const isRunPaused = branchState.current?.status === 'paused';
  const isPauseActive = isRunPausing || isRunPaused;
  const isStoppingRun =
    runControlRequest?.threadId === stream.threadId &&
    runControlRequest.action === 'stop';
  const canStopRun = Boolean(
    stream.threadId &&
    pauseRunId &&
    (stream.isLoading ||
      ['busy', 'pausing', 'paused'].includes(
        branchState.current?.status ?? '',
      )),
  );
  const isResumingRun =
    runControlRequest?.threadId === stream.threadId &&
    runControlRequest.action === 'resume';

  const isVisibleStreaming = stream.isLoading && !stream.isThreadInterrupted;
  const handleComposerRunControl = async (
    action: 'pause' | 'resume' | 'stop',
  ) => {
    const sourceThreadId = stream.threadId;
    if (
      !sourceThreadId ||
      !pauseRunId ||
      isChangingBranch ||
      isStoppingRun ||
      isResumingRun
    )
      return;
    if (action === 'resume' && (!isRunPaused || !currentRunControl?.pauseId))
      return;
    if (action === 'pause' && (isRunPaused || isRunPausing)) return;
    if (action === 'stop' && !canStopRun) return;
    // Stopping remains available even while a pause HTTP request is pending.
    if (
      action !== 'stop' &&
      runControlRequestRef.current?.threadId === sourceThreadId
    )
      return;
    const runId = pauseRunId;
    const request = {
      action,
      threadId: sourceThreadId,
      runId,
    };
    runControlRequestRef.current = request;
    setRunControlRequest(request);
    clearRunControlError();
    const errorGeneration = errorGenerationRef.current;
    try {
      if (action === 'stop') {
        await stream.stop(request.runId);
      } else if (action === 'resume' && currentRunControl?.pauseId) {
        await stream.resumeRun(request.runId, currentRunControl.pauseId);
      } else {
        await stream.pauseRun(request.runId);
      }
    } catch (error) {
      if (
        activeBranchRef.current === sourceThreadId &&
        runControlRequestRef.current === request &&
        errorGenerationRef.current === errorGeneration
      ) {
        setRunControlError({
          threadId: sourceThreadId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      if (activeBranchRef.current === sourceThreadId)
        await branchState.refresh();
      if (runControlRequestRef.current === request) {
        runControlRequestRef.current = null;
        setRunControlRequest(null);
      }
    }
  };
  return {
    isResumingRun,
    isRunPausing,
    isRunPaused,
    isVisibleStreaming,
    isPauseActive,
    runControlError,
    clearRunControlError,
    canPauseRun,
    handleComposerRunControl,
    canStopRun,
    isStoppingRun,
    currentRunControl,
  };
}
