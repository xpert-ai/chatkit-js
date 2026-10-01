import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { useRuntimeActivities } from '../../runtime-activities';
import type { useStreamFollowUpState } from '../follow-ups/useStreamFollowUpState';
import { createEmptyHistoryMessagePagination } from '../history/pagination';
import type { useStreamHost } from '../host/useStreamHost';
import type { useStreamInterrupts } from '../interrupts/useStreamInterrupts';
import type { useStreamUserInput } from '../interrupts/useStreamUserInput';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunState } from '../runs/useStreamRunState';
import type { useStreamScope } from '../scope/useStreamScope';
import { createAbortError } from '../transport/errors';
import type { ChatKitAIMessage, StateType } from '../types';

type StreamLifecycleOptions = Pick<
  ReturnType<typeof useStreamScope>,
  | 'consumedInitialThreadRef'
  | 'threadId'
  | 'lastThreadIdRef'
  | 'updateConversationId'
  | 'updateConnectorBindingIdsState'
  | 'activeThreadIdRef'
  | 'suppressThreadChangeRef'
  | 'setThreadId'
> &
  Pick<
    ReturnType<typeof useStreamRunState>,
    | 'abortRef'
    | 'isLoadingRef'
    | 'lastEventIdRef'
    | 'pauseRequestedRef'
    | 'setPausedDisplay'
    | 'setIsLoading'
    | 'setError'
    | 'shouldStartFreshAssistantMessageAfterSteerRef'
    | 'rememberActiveRunId'
  > &
  Pick<ReturnType<typeof useStreamUserInput>, 'clearPendingRequestUserInput'> &
  Pick<ReturnType<typeof useStreamInterrupts>, 'clearPendingHITLRequest'> &
  Pick<
    ReturnType<typeof useStreamMessages>,
    | 'setContextUsageByAgentKey'
    | 'updateTodos'
    | 'setThreadGoal'
    | 'valuesRef'
    | 'setValues'
    | 'updateHistoryMessagePagination'
  > &
  Pick<ReturnType<typeof useStreamHost>, 'resetHistory'> &
  Pick<
    ReturnType<typeof useStreamFollowUpState>,
    | 'setPendingFollowUps'
    | 'setAutoQueuedFollowUpIds'
    | 'pendingFollowUpsRef'
    | 'autoQueuedFollowUpIdsRef'
    | 'steerPriorityFollowUpIdsRef'
  > &
  Pick<
    ReturnType<typeof useRuntimeActivities<StateType>>,
    'clearRuntimeActivities'
  > & {
    resetThreadOnMount: boolean;
  };

export function useStreamLifecycle({
  consumedInitialThreadRef,
  abortRef,
  isLoadingRef,
  clearPendingRequestUserInput,
  clearPendingHITLRequest,
  threadId,
  lastThreadIdRef,
  lastEventIdRef,
  setContextUsageByAgentKey,
  resetHistory,
  pauseRequestedRef,
  setPausedDisplay,
  setIsLoading,
  setError,
  setPendingFollowUps,
  setAutoQueuedFollowUpIds,
  pendingFollowUpsRef,
  autoQueuedFollowUpIdsRef,
  steerPriorityFollowUpIdsRef,
  updateTodos,
  clearRuntimeActivities,
  setThreadGoal,
  valuesRef,
  setValues,
  updateHistoryMessagePagination,
  updateConversationId,
  updateConnectorBindingIdsState,
  activeThreadIdRef,
  shouldStartFreshAssistantMessageAfterSteerRef,
  rememberActiveRunId,
  suppressThreadChangeRef,
  setThreadId,
  resetThreadOnMount,
}: StreamLifecycleOptions) {
  useEffect(() => {
    return () => {
      consumedInitialThreadRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
      isLoadingRef.current = false;
      clearPendingRequestUserInput(
        createAbortError('The user input request was cancelled.'),
      );
      clearPendingHITLRequest(
        createAbortError('The HITL request was cancelled.'),
      );
    };
  }, [clearPendingHITLRequest, clearPendingRequestUserInput]);

  useEffect(() => {
    const currentThreadId = threadId ?? null;
    if (lastThreadIdRef.current !== currentThreadId) {
      lastThreadIdRef.current = currentThreadId;
      lastEventIdRef.current = null;
      setContextUsageByAgentKey({});
      clearPendingRequestUserInput(
        createAbortError('The user input request was cancelled.'),
      );
      clearPendingHITLRequest(
        createAbortError('The HITL request was cancelled.'),
      );
    }
  }, [clearPendingHITLRequest, clearPendingRequestUserInput, threadId]);

  const reset = useCallback(
    (
      newThreadId?: string | null,
      initialMessages?: ChatKitAIMessage[],
      options?: { suppressThreadChange?: boolean },
    ) => {
      resetHistory();
      pauseRequestedRef.current = false;
      setPausedDisplay(null);
      abortRef.current?.abort();
      abortRef.current = null;
      setIsLoading(false);
      isLoadingRef.current = false;
      setError(null);
      clearPendingRequestUserInput(
        createAbortError('The user input request was cancelled.'),
      );
      clearPendingHITLRequest(
        createAbortError('The HITL request was cancelled.'),
      );
      setPendingFollowUps([]);
      setAutoQueuedFollowUpIds([]);
      pendingFollowUpsRef.current = [];
      autoQueuedFollowUpIdsRef.current = new Set();
      steerPriorityFollowUpIdsRef.current = new Set();
      updateTodos(null);
      clearRuntimeActivities();
      setContextUsageByAgentKey({});
      setThreadGoal(null);
      valuesRef.current = { messages: initialMessages ?? [] };
      setValues(valuesRef.current);
      updateHistoryMessagePagination(createEmptyHistoryMessagePagination());
      updateConversationId(null);
      updateConnectorBindingIdsState([]);
      activeThreadIdRef.current = newThreadId ?? null;
      shouldStartFreshAssistantMessageAfterSteerRef.current = false;
      rememberActiveRunId(null);
      lastEventIdRef.current = null;
      if (newThreadId !== undefined) {
        if (options?.suppressThreadChange && newThreadId !== threadId) {
          suppressThreadChangeRef.current = true;
        }
        setThreadId(newThreadId);
      }
    },
    [
      clearPendingHITLRequest,
      clearPendingRequestUserInput,
      clearRuntimeActivities,
      setThreadId,
      threadId,
      updateConversationId,
      updateConnectorBindingIdsState,
      updateHistoryMessagePagination,
      updateTodos,
      resetHistory,
      rememberActiveRunId,
    ],
  );

  const shouldResetThreadOnMountRef = useRef(resetThreadOnMount);

  useLayoutEffect(() => {
    if (!shouldResetThreadOnMountRef.current) return;
    shouldResetThreadOnMountRef.current = false;
    consumedInitialThreadRef.current = null;
    reset(null, []);
  }, [reset]);
  return { reset };
}
