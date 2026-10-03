import * as React from 'react';
import type { useChatBranchState } from './useChatBranchState';
import type { useChatEnvironment } from './useChatEnvironment';

type ChatRunControlOptions = Pick<
  ReturnType<typeof useChatBranchState>,
  'branchState' | 'isChangingBranch' | 'activeBranchRef'
> &
  Pick<ReturnType<typeof useChatEnvironment>, 'stream'>;

export function useChatRunControl({
  branchState,
  stream,
  isChangingBranch,
  activeBranchRef,
}: ChatRunControlOptions) {
  const [runControlRequest, setRunControlRequest] = React.useState<{
    action: 'pause' | 'resume';
    threadId: string;
    runId: string;
  } | null>(null);

  const runControlRequestRef = React.useRef<typeof runControlRequest>(null);
  const [runControlError, setRunControlError] = React.useState<{
    threadId: string;
    message: string;
  } | null>(null);

  const currentRunControl = branchState.current?.runControl;
  const pauseRunId =
    stream.activeRunId ??
    currentRunControl?.executionId ??
    stream.displayPause?.executionId ??
    null;

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
  const canRevealPausedDisplay =
    Boolean(stream.displayPause) &&
    ['idle', 'error', 'interrupted'].includes(
      branchState.current?.status ?? '',
    );

  // Switch the control as soon as output pauses, before checkpointing finishes.
  const isPauseActive = isRunPausing || isRunPaused || stream.isDisplayPaused;
  const isResumingRun =
    runControlRequest?.threadId === stream.threadId &&
    runControlRequest.action === 'resume';

  const isVisibleStreaming =
    stream.isLoading && !stream.isDisplayPaused && !stream.isThreadInterrupted;
  const handleComposerRunControl = async (action: 'pause' | 'resume') => {
    const sourceThreadId = stream.threadId;
    if (isChangingBranch || isRunPausing || isResumingRun) return;
    if (action === 'resume') {
      if (
        !sourceThreadId ||
        (!canRevealPausedDisplay &&
          (!isRunPaused || !currentRunControl?.pauseId))
      )
        return;
    } else {
      if (isRunPaused) return;
      if (!sourceThreadId || !pauseRunId) return;
    }
    if (!sourceThreadId) return;
    if (runControlRequestRef.current?.threadId === sourceThreadId) return;
    const runId = pauseRunId;
    if (!runId) return;
    const request = {
      action,
      threadId: sourceThreadId,
      runId,
    };
    runControlRequestRef.current = request;
    setRunControlRequest(request);
    setRunControlError(null);
    try {
      if (action === 'resume' && canRevealPausedDisplay) {
        await stream.resumeDisplay();
      } else if (action === 'resume' && currentRunControl?.pauseId) {
        await stream.resumeRun(request.runId, currentRunControl.pauseId);
      } else {
        await stream.pauseRun(request.runId);
      }
      if (activeBranchRef.current === sourceThreadId) {
        await branchState.refresh();
      }
    } catch (error) {
      if (
        activeBranchRef.current === sourceThreadId &&
        runControlRequestRef.current === request
      ) {
        setRunControlError({
          threadId: sourceThreadId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
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
    canPauseRun,
    handleComposerRunControl,
    canRevealPausedDisplay,
    currentRunControl,
  };
}
