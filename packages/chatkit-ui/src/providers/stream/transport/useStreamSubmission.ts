import { useCallback } from 'react';
import {
  createPendingFollowUp,
  movePendingFollowUpBeforeQueuedItems,
  type PendingFollowUp,
} from '../../../lib/follow-ups';
import { createMessageId } from '../../../lib/utils';
import {
  createXpertThreadConversation,
  withPersistedRuntimeResources,
} from '../../../lib/xpert-conversation-bootstrap';
import type { useRuntimeActivities } from '../../runtime-activities';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import type { useStreamFollowUpState } from '../follow-ups/useStreamFollowUpState';
import type { useStreamFollowUps } from '../follow-ups/useStreamFollowUps';
import { createEmptyHistoryMessagePagination } from '../history/pagination';
import type { useStreamHost } from '../host/useStreamHost';
import { applyOptimisticValues } from '../messages/reducer';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunControl } from '../runs/useStreamRunControl';
import type { useStreamRunState } from '../runs/useStreamRunState';
import {
  getConversationThreadId,
  isResumeRunInput,
} from '../scope/thread-identity';
import type { useStreamScope } from '../scope/useStreamScope';
import type {
  ChatKitAIMessage,
  StateType,
  StreamRunInput,
  StreamSubmitOptions,
} from '../types';
import { createAbortError, normalizeSubmissionError } from './errors';
import { retainResumeStreamOptions } from './request-options';
import type { useStreamTransport } from './useStreamTransport';

type StreamSubmissionOptions = Pick<
  ReturnType<typeof useStreamRunState>,
  | 'setError'
  | 'pauseRequestedRef'
  | 'isLoadingRef'
  | 'lastExecutionIdRef'
  | 'lastStreamOptionsRef'
  | 'rememberActiveRunId'
  | 'lastEventIdRef'
  | 'setIsLoading'
  | 'submitRef'
> &
  Pick<
    ReturnType<typeof useStreamScope>,
    | 'activeThreadIdRef'
    | 'threadId'
    | 'conversationIdRef'
    | 'connectorBindingIdsRef'
    | 'updateConversationId'
    | 'updateConnectorBindingIdsState'
    | 'setThreadId'
  > &
  Pick<ReturnType<typeof useStreamCredentials>, 'client'> &
  Pick<ReturnType<typeof useStreamRunControl>, 'disconnect'> &
  Pick<
    ReturnType<typeof useStreamFollowUpState>,
    | 'pendingFollowUpsRef'
    | 'setPendingFollowUps'
    | 'addAutoQueuedFollowUpIds'
    | 'addSteerPriorityFollowUpIds'
    | 'markPendingFollowUpsAsQueued'
  > &
  Pick<ReturnType<typeof useStreamFollowUps>, 'sendSteerFollowUp'> &
  Pick<
    ReturnType<typeof useStreamMessages>,
    | 'valuesRef'
    | 'setValues'
    | 'setContextUsageByAgentKey'
    | 'updateTodos'
    | 'updateHistoryMessagePagination'
  > &
  Pick<
    ReturnType<typeof useRuntimeActivities<StateType>>,
    'clearRuntimeActivities'
  > &
  Pick<ReturnType<typeof useStreamHost>, 'markHistoryLoaded'> &
  Pick<ReturnType<typeof useStreamTransport>, 'runStream'> & {
    assistantId: string;
    projectId: string | undefined;
  };

export function useStreamSubmission({
  setError,
  pauseRequestedRef,
  activeThreadIdRef,
  threadId,
  client,
  disconnect,
  isLoadingRef,
  lastExecutionIdRef,
  pendingFollowUpsRef,
  setPendingFollowUps,
  addAutoQueuedFollowUpIds,
  addSteerPriorityFollowUpIds,
  sendSteerFollowUp,
  markPendingFollowUpsAsQueued,
  conversationIdRef,
  connectorBindingIdsRef,
  valuesRef,
  lastStreamOptionsRef,
  setValues,
  setContextUsageByAgentKey,
  updateTodos,
  clearRuntimeActivities,
  updateConversationId,
  updateConnectorBindingIdsState,
  updateHistoryMessagePagination,
  rememberActiveRunId,
  lastEventIdRef,
  setIsLoading,
  setThreadId,
  assistantId,
  projectId,
  markHistoryLoaded,
  runStream,
  submitRef,
}: StreamSubmissionOptions) {
  const submit = useCallback(
    async (input?: StreamRunInput | null, options?: StreamSubmitOptions) => {
      setError(null);
      const humanInput = input && 'input' in input ? input : null;
      if (humanInput && pauseRequestedRef.current && !options?.newThread) {
        const target =
          options?.threadId ?? activeThreadIdRef.current ?? threadId;
        if (target) {
          try {
            const current = await client.threads.get(target);
            if (activeThreadIdRef.current !== target) {
              throw createAbortError(
                'The active thread changed before sending.',
              );
            }
            if (current.status === 'pausing' || current.status === 'busy') {
              throw new Error(
                'The workflow is still pausing. Wait for it to pause before sending a new message.',
              );
            }
            if (current.status === 'paused') {
              if (!current.runControl?.executionId) {
                throw new Error('The paused task has no execution identity.');
              }
              await client.runs.cancel(
                target,
                current.runControl.executionId,
                true,
              );
            }
            if (activeThreadIdRef.current !== target) {
              throw createAbortError(
                'The active thread changed before sending.',
              );
            }
            disconnect();
            pauseRequestedRef.current = false;
          } catch (error) {
            if (activeThreadIdRef.current === target) setError(error);
            throw error;
          }
        }
      }
      const followUpMode =
        isLoadingRef.current && !pauseRequestedRef.current
          ? options?.followUpMode
          : undefined;
      if (humanInput && followUpMode) {
        const pending = createPendingFollowUp(
          {
            ...humanInput,
            id: humanInput.id ?? createMessageId(),
            executionId:
              humanInput.executionId ?? lastExecutionIdRef.current ?? undefined,
            followUpMode,
          },
          followUpMode,
          options,
        );

        if (!pending) {
          return;
        }

        const addPending = (prev: PendingFollowUp[]) => {
          const remaining = prev.filter((item) => item.id !== pending.id);
          if (pending.mode === 'steer') {
            return movePendingFollowUpBeforeQueuedItems(remaining, pending.id, {
              ...pending,
              queuedFromSteer: true,
            });
          }

          return [...remaining, pending];
        };
        pendingFollowUpsRef.current = addPending(pendingFollowUpsRef.current);
        setPendingFollowUps(addPending);
        if (followUpMode === 'queue') {
          addAutoQueuedFollowUpIds([pending.id]);
        }

        const activeThreadId = activeThreadIdRef.current ?? threadId ?? null;
        if (followUpMode === 'steer' && activeThreadId) {
          addSteerPriorityFollowUpIds([pending.id]);
          try {
            await sendSteerFollowUp(activeThreadId, pending.request, options);
          } catch (followUpError) {
            setError(followUpError);
            markPendingFollowUpsAsQueued([pending.id], {
              autoDrain: true,
              queuedFromSteer: true,
            });
          }
        }
        return;
      }

      const previousThreadId = activeThreadIdRef.current ?? threadId ?? null;

      const previousActiveThreadId = activeThreadIdRef.current;
      const previousConversationId = conversationIdRef.current;
      const previousConnectorBindingIds = connectorBindingIdsRef.current;
      const valuesBeforeSubmission = valuesRef.current;
      lastStreamOptionsRef.current = retainResumeStreamOptions(options);
      const shouldStartNewThread = options?.newThread === true;
      if (shouldStartNewThread) {
        setValues({ messages: [] });
        setContextUsageByAgentKey({});
        updateTodos(null);
        clearRuntimeActivities();
        updateConversationId(null);
        updateConnectorBindingIdsState([]);
        updateHistoryMessagePagination(createEmptyHistoryMessagePagination());
        rememberActiveRunId(null);
        lastEventIdRef.current = null;
      }
      const optimistic = options?.optimisticValues;
      let preservedMessages: ChatKitAIMessage[] | undefined;
      if (optimistic) {
        const previousValues = shouldStartNewThread
          ? { messages: [] }
          : valuesBeforeSubmission;
        const optimisticValues = applyOptimisticValues(
          previousValues,
          optimistic,
        );
        if (options?.preserveOptimisticMessages) {
          const previousIds = new Set(
            (previousValues.messages ?? [])
              .map((message) => message.id)
              .filter(
                (id): id is string => typeof id === 'string' && id.length > 0,
              ),
          );
          preservedMessages = (optimisticValues.messages ?? []).filter(
            (message) => {
              const messageId = message.id;
              return (
                typeof messageId === 'string' &&
                messageId.length > 0 &&
                !previousIds.has(messageId)
              );
            },
          );
        }
        valuesRef.current = optimisticValues;
        setValues(optimisticValues);
      }

      let createdThreadId: string | null = null;
      setIsLoading(true);
      isLoadingRef.current = true;
      try {
        const desiredThreadId = options?.threadId ?? null;
        let nextThreadId =
          options?.joinExistingThread && desiredThreadId
            ? desiredThreadId
            : (threadId ?? null);
        if (shouldStartNewThread) {
          nextThreadId = null;
        }
        if (!nextThreadId && isResumeRunInput(input)) {
          const conversation = await client.conversations.get(
            input.conversationId,
          );
          const resumeThreadId = getConversationThreadId(conversation);
          if (!resumeThreadId) {
            throw new Error('Missing thread context for HITL resume');
          }

          nextThreadId = resumeThreadId;
          updateConversationId(input.conversationId);
          activeThreadIdRef.current = resumeThreadId;
          setThreadId(resumeThreadId);
        }
        if (!nextThreadId && desiredThreadId && options?.joinExistingThread) {
          nextThreadId = desiredThreadId;
          activeThreadIdRef.current = desiredThreadId;
          setThreadId(desiredThreadId);
        }
        if (!nextThreadId && desiredThreadId) {
          const created = await createXpertThreadConversation(client, {
            assistantId,
            threadId: desiredThreadId,
            projectId,
            runtimeResources:
              input && !isResumeRunInput(input)
                ? input.input.runtimeResources
                : undefined,
            connectorBindingIds: connectorBindingIdsRef.current,
            onThreadCreated: (resolvedThreadId) => {
              createdThreadId = resolvedThreadId;
            },
          });
          nextThreadId = created.threadId;
          if (input && !isResumeRunInput(input)) {
            input = withPersistedRuntimeResources(
              input,
              created.runtimeResources,
            );
          }
          updateConversationId(created.conversation.id);
          setThreadId(nextThreadId);
        }
        if (!nextThreadId) {
          const created = await createXpertThreadConversation(client, {
            assistantId,
            projectId,
            runtimeResources:
              input && !isResumeRunInput(input)
                ? input.input.runtimeResources
                : undefined,
            connectorBindingIds: connectorBindingIdsRef.current,
            onThreadCreated: (resolvedThreadId) => {
              createdThreadId = resolvedThreadId;
            },
          });
          nextThreadId = created.threadId;
          if (input && !isResumeRunInput(input)) {
            input = withPersistedRuntimeResources(
              input,
              created.runtimeResources,
            );
          }
          updateConversationId(created.conversation.id);
          setThreadId(nextThreadId);
        }
        if (desiredThreadId && desiredThreadId !== nextThreadId) {
          nextThreadId = desiredThreadId;
          setThreadId(desiredThreadId);
        }
        if (options?.onThreadResolved) {
          void Promise.resolve(
            options.onThreadResolved(nextThreadId, conversationIdRef.current),
          ).catch((callbackError) => {
            console.warn(
              '[chatkit-ui] Failed to run thread resolved callback',
              callbackError,
            );
          });
        }
        if (nextThreadId !== previousThreadId) {
          lastEventIdRef.current = null;
        }
        activeThreadIdRef.current = nextThreadId;
        markHistoryLoaded(nextThreadId);

        await runStream(
          nextThreadId,
          input,
          options,
          undefined,
          preservedMessages,
        );
      } catch (submissionError) {
        const normalizedError = normalizeSubmissionError(submissionError);
        valuesRef.current = valuesBeforeSubmission;
        setValues(valuesBeforeSubmission);
        updateConversationId(previousConversationId);
        updateConnectorBindingIdsState(previousConnectorBindingIds);
        activeThreadIdRef.current = previousActiveThreadId;
        setThreadId(previousThreadId);
        setError(normalizedError);
        isLoadingRef.current = false;
        setIsLoading(false);
        if (createdThreadId) {
          try {
            await client.threads.delete(createdThreadId);
          } catch (rollbackError) {
            console.warn(
              '[chatkit-ui] Failed to roll back an incomplete thread',
              rollbackError,
            );
          }
        }
        throw normalizedError;
      }
    },
    [
      assistantId,
      client,
      addAutoQueuedFollowUpIds,
      addSteerPriorityFollowUpIds,
      markPendingFollowUpsAsQueued,
      runStream,
      markHistoryLoaded,
      disconnect,
      clearRuntimeActivities,
      sendSteerFollowUp,
      setThreadId,
      threadId,
      projectId,
      updateConversationId,
      updateConnectorBindingIdsState,
      updateHistoryMessagePagination,
      updateTodos,
      rememberActiveRunId,
    ],
  );

  submitRef.current = submit;
  return { submit };
}
