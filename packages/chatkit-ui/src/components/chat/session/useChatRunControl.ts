import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import * as React from 'react';
import type { useChatBranchState } from './useChatBranchState';
import type { useChatEnvironment } from './useChatEnvironment';

type ChatRunControlOptions = Pick<
  ReturnType<typeof useChatBranchState>,
  'isChangingBranch' | 'activeBranchRef'
> & {
  branchState: Pick<
    ReturnType<typeof useChatBranchState>['branchState'],
    'current' | 'refresh'
  > & { controlUnavailable?: boolean };
  stream: Pick<
    ReturnType<typeof useChatEnvironment>['stream'],
    | 'connectionState'
    | 'threadId'
    | 'isLoading'
    | 'activeRunId'
    | 'isThreadInterrupted'
    | 'stop'
    | 'pauseRun'
    | 'resumeRun'
  >;
};

export function useChatRunControl({
  branchState,
  stream,
  isChangingBranch,
  activeBranchRef,
}: ChatRunControlOptions) {
  const { t } = useChatkitTranslation();
  const connected =
    !stream.connectionState || stream.connectionState === 'connected';
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

  const [acceptedStop, setAcceptedStop] = React.useState<{
    threadId: string;
    runId: string;
  } | null>(null);
  React.useEffect(() => {
    setAcceptedStop(null);
  }, [stream.threadId]);
  const errorGenerationRef = React.useRef(0);
  const clearRunControlError = React.useCallback(() => {
    errorGenerationRef.current += 1;
    setRunControlError(null);
  }, []);
  React.useEffect(clearRunControlError, [
    stream.threadId,
    clearRunControlError,
  ]);

  const controlView = branchState.current?.controlView;
  const targetMatches =
    !controlView ||
    !stream.isLoading ||
    !stream.activeRunId ||
    controlView.runId === stream.activeRunId;
  const controlsFresh =
    connected && !branchState.controlUnavailable && targetMatches;
  React.useEffect(() => {
    if (
      acceptedStop?.threadId === stream.threadId &&
      controlView &&
      (controlView.runId !== acceptedStop.runId ||
        ['stopped', 'completed', 'failed', 'idle'].includes(controlView.state))
    )
      setAcceptedStop(null);
  }, [acceptedStop, controlView, stream.threadId]);
  const currentRunControl = branchState.current?.runControl;
  const pauseRunId = controlView
    ? controlView.runId
    : stream.isLoading
      ? (stream.activeRunId ?? currentRunControl?.executionId ?? null)
      : (currentRunControl?.executionId ?? stream.activeRunId ?? null);

  const canPauseRun = controlView
    ? controlsFresh && controlView.actions.canPause
    : Boolean(
        stream.threadId &&
        pauseRunId &&
        !stream.isThreadInterrupted &&
        (stream.isLoading || currentRunControl?.state === 'running'),
      );

  const isRunPausing =
    (runControlRequest?.threadId === stream.threadId &&
      runControlRequest.action === 'pause') ||
    (controlView
      ? controlView.state === 'pausing'
      : branchState.current?.status === 'pausing');

  const isRunPaused = controlView
    ? controlView.state === 'paused'
    : branchState.current?.status === 'paused';
  const isPauseActive = isRunPausing || isRunPaused;
  const isStoppingRun =
    (runControlRequest?.threadId === stream.threadId &&
      runControlRequest.action === 'stop') ||
    acceptedStop?.threadId === stream.threadId ||
    (controlView
      ? controlView.state === 'stopping'
      : currentRunControl?.state === 'terminating');
  const canStopRun =
    !isStoppingRun &&
    targetMatches &&
    (controlView
      ? controlView.actions.canTerminate
      : Boolean(
          stream.threadId &&
          pauseRunId &&
          (stream.isLoading ||
            ['busy', 'pausing', 'paused'].includes(
              branchState.current?.status ?? '',
            )),
        ));
  const isResumingRun =
    runControlRequest?.threadId === stream.threadId &&
    runControlRequest.action === 'resume';

  const isVisibleStreaming =
    connected && stream.isLoading && !stream.isThreadInterrupted;
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
    if (
      action === 'resume' &&
      (!controlsFresh ||
        !isRunPaused ||
        !(controlView?.pauseId ?? currentRunControl?.pauseId) ||
        (controlView && !controlView.actions.canResume))
    )
      return;
    if (action === 'pause' && (!canPauseRun || isRunPaused || isRunPausing))
      return;
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
        if (
          activeBranchRef.current === sourceThreadId &&
          runControlRequestRef.current === request &&
          errorGenerationRef.current === errorGeneration
        )
          setAcceptedStop({ threadId: sourceThreadId, runId });
      } else if (
        action === 'resume' &&
        (controlView?.pauseId ?? currentRunControl?.pauseId)
      ) {
        await stream.resumeRun(
          request.runId,
          (controlView?.pauseId ?? currentRunControl?.pauseId)!,
        );
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
          message: t('connection.actionUnconfirmed'),
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
    controlView,
    resumePauseId: controlView
      ? controlView.pauseId
      : currentRunControl?.pauseId,
    canRespond:
      controlsFresh &&
      !isStoppingRun &&
      (!controlView || controlView.actions.canRespond),
    canResumeRun:
      controlsFresh &&
      (controlView ? controlView.actions.canResume : isRunPaused),
    canSubmit:
      !isStoppingRun &&
      !branchState.controlUnavailable &&
      (controlView
        ? controlsFresh &&
          (controlView.actions.canSend ||
            (controlView.actions.canQueue && stream.isLoading))
        : !isStoppingRun),
    controlStatus: isStoppingRun ? 'stopping' : controlView?.state,
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
