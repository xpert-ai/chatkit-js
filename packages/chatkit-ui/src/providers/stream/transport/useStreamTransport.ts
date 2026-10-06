import type { Config } from '@xpert-ai/xpert-sdk';
import { useCallback, useEffect, useRef } from 'react';
import { resolveFollowUpConsumedIds } from '../../../lib/follow-up-consumed';
import { getPendingSteerFollowUpIds } from '../../../lib/follow-ups';
import { normalizeRequestContextAndConfig } from '../../../lib/request-options';
import { applyThreadContextUsageEvent } from '../../../lib/thread-context-usage';
import {
  createLangGraphEventState,
  type LangGraphEventContext,
} from '../../langGraphEventMapper';
import type { useRuntimeActivities } from '../../runtime-activities';
import type { useConversationProject } from '../../useConversationProject';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import { applyStreamEvent } from '../events/apply-stream-event';
import type { StreamChunk } from '../events/envelope';
import type { useStreamFollowUpState } from '../follow-ups/useStreamFollowUpState';
import type { useStreamHistoryMessages } from '../history/useStreamHistoryMessages';
import type { useStreamHost } from '../host/useStreamHost';
import type { useStreamInterrupts } from '../interrupts/useStreamInterrupts';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunState } from '../runs/useStreamRunState';
import type { useStreamScope } from '../scope/useStreamScope';
import type {
  ChatKitAIMessage,
  ProjectSelection,
  StateType,
  StreamRunInput,
  StreamSubmitOptions,
} from '../types';
import { shouldIgnoreStreamError } from './errors';
import {
  mergeStreamRequestContext,
  withConversationScope,
} from './request-options';

type StreamTransportOptions = Pick<
  ReturnType<typeof useStreamRunState>,
  | 'abortRef'
  | 'setIsLoading'
  | 'setInterruptedThreadId'
  | 'isLoadingRef'
  | 'lastEventIdRef'
  | 'setError'
  | 'rememberActiveRunId'
  | 'shouldStartFreshAssistantMessageAfterSteerRef'
  | 'pauseRequestedRef'
> &
  Pick<
    ReturnType<typeof useStreamScope>,
    | 'connectorBindingIdsRef'
    | 'updateConversationId'
    | 'conversationIdRef'
    | 'threadId'
  > &
  Pick<ReturnType<typeof useStreamCredentials>, 'client'> &
  Pick<
    ReturnType<typeof useStreamMessages>,
    | 'setValues'
    | 'setContextUsageByAgentKey'
    | 'todosRef'
    | 'updateTodos'
    | 'setThreadGoal'
  > &
  Pick<ReturnType<typeof useStreamHost>, 'streamSendEvent'> &
  Pick<
    ReturnType<typeof useStreamFollowUpState>,
    | 'flushSteerFollowUps'
    | 'removePendingFollowUps'
    | 'pendingFollowUpsRef'
    | 'steerPriorityFollowUpIdsRef'
    | 'markPendingFollowUpsAsQueued'
  > &
  Pick<
    ReturnType<typeof useRuntimeActivities<StateType>>,
    'handleRuntimeActivityTrigger'
  > &
  Pick<ReturnType<typeof useStreamInterrupts>, 'handleInterrupt'> &
  Pick<
    ReturnType<typeof useStreamHistoryMessages>,
    'reconcileLatestAssistantMessage'
  > & {
    additionalContext: Record<string, unknown> | undefined;
    conversationProject: ReturnType<typeof useConversationProject>;
    projectSelection: ProjectSelection | undefined;
    assistantId: string;
    refreshConversationProject: ReturnType<
      typeof useConversationProject
    >['refresh'];
    projectId: string | undefined;
  };

export function useStreamTransport({
  abortRef,
  threadId,
  setIsLoading,
  setInterruptedThreadId,
  isLoadingRef,
  additionalContext,
  conversationProject,
  connectorBindingIdsRef,
  projectSelection,
  client,
  assistantId,
  lastEventIdRef,
  setValues,
  setError,
  streamSendEvent,
  rememberActiveRunId,
  setContextUsageByAgentKey,
  flushSteerFollowUps,
  shouldStartFreshAssistantMessageAfterSteerRef,
  removePendingFollowUps,
  todosRef,
  updateTodos,
  handleRuntimeActivityTrigger,
  setThreadGoal,
  updateConversationId,
  refreshConversationProject,
  pauseRequestedRef,
  handleInterrupt,
  conversationIdRef,
  reconcileLatestAssistantMessage,
  pendingFollowUpsRef,
  steerPriorityFollowUpIdsRef,
  markPendingFollowUpsAsQueued,
  projectId,
}: StreamTransportOptions) {
  const replayState = useRef(
    new Map<
      string,
      { cursor?: string; state: ReturnType<typeof createLangGraphEventState> }
    >(),
  );
  useEffect(() => {
    replayState.current.clear();
  }, [client, assistantId, projectId, threadId]);
  const runStream = useCallback(
    async (
      nextThreadId: string,
      input?: StreamRunInput | null,
      options?: StreamSubmitOptions,
      runId?: string,
      preservedMessages?: ChatKitAIMessage[],
    ) => {
      // Never let discovery steal a locally submitted or already joined output consumer.
      if (options?.joinExistingThread && runId && isLoadingRef.current) return;
      const replayKey = `${nextThreadId}:${runId ?? ''}`;
      const previous =
        options?.joinExistingThread && lastEventIdRef.current
          ? replayState.current.get(replayKey)
          : undefined;
      const langGraphEventState =
        previous?.state ?? createLangGraphEventState();
      const cursor = previous?.cursor;
      const abortController = new AbortController();
      abortRef.current?.abort();
      abortRef.current = abortController;
      if (options?.joinExistingThread && runId) rememberActiveRunId(runId);
      setIsLoading(true);
      setInterruptedThreadId(null);
      isLoadingRef.current = true;
      let transportError: unknown = null;
      let streamCompleted = false;
      let streamingRunId = runId;
      let receivedOutput = false;
      let runAccepted = false;
      try {
        const normalizedRequest = normalizeRequestContextAndConfig({
          context: mergeStreamRequestContext(
            options?.context,
            additionalContext,
          ),
          config: options?.config,
        });
        const scopedInput = withConversationScope(
          input,
          conversationProject.projectId,
          connectorBindingIdsRef.current,
          conversationProject.projectId
            ? { mode: 'existing', projectId: conversationProject.projectId }
            : conversationProject.fromHistory
              ? { mode: 'none' }
              : projectSelection,
        );
        const stream =
          options?.joinExistingThread && runId
            ? client.runs.joinStream(nextThreadId, runId, {
                signal: abortController.signal,
                lastEventId: cursor,
              })
            : client.runs.stream(nextThreadId, assistantId, {
                input: scopedInput ?? null,
                context: normalizedRequest.context,
                config: normalizedRequest.config as Config | undefined,
                checkpoint: options?.checkpoint ?? undefined,
                streamMode: options?.streamMode,
                streamSubgraphs: options?.streamSubgraphs,
                streamResumable: options?.streamResumable,
                signal: abortController.signal,
                onDisconnect: 'continue',
                onRunCreated: () => {
                  runAccepted = true;
                  options?.onRunAccepted?.();
                },
              });

        const interrupts: unknown[] = [];
        const eventContext: LangGraphEventContext = {
          threadId: nextThreadId,
          input: scopedInput,
        };
        for await (const chunk of stream) {
          if (
            abortController.signal.aborted ||
            abortRef.current !== abortController
          )
            break;
          if (!receivedOutput) {
            receivedOutput = true;
            setError(null);
          }
          if (chunk?.id) {
            lastEventIdRef.current = String(chunk.id);
            if (streamingRunId)
              replayState.current.set(`${nextThreadId}:${streamingRunId}`, {
                cursor: String(chunk.id),
                state: langGraphEventState,
              });
          }
          if (chunk.event === 'complete' || chunk.data?.type === 'complete')
            streamCompleted = true;
          if (chunk.data?.type === 'stream_start') {
            // Preserve the loaded snapshot until a complete replay is available.
            if (options?.joinExistingThread && runId && !cursor) {
              setValues((value) => ({
                ...value,
                messages: value.messages.filter(
                  (message) =>
                    message.executionId !== runId ||
                    !['ai', 'assistant'].includes(message.type),
                ),
              }));
            }
            continue;
          }
          if (chunk.data?.type === 'stream_resync') {
            streamCompleted = true;
            replayState.current.delete(replayKey);
            break;
          }
          applyStreamEvent(
            chunk as StreamChunk,
            setValues,
            setError,
            streamSendEvent,
            interrupts,
            langGraphEventState,
            eventContext,
            (executionId) => {
              if (executionId) {
                streamingRunId = executionId;
                if (chunk.id)
                  replayState.current.set(`${nextThreadId}:${executionId}`, {
                    cursor: String(chunk.id),
                    state: langGraphEventState,
                  });
                rememberActiveRunId(executionId);
              }
            },
            (event) => {
              setContextUsageByAgentKey((prev) =>
                applyThreadContextUsageEvent(prev, event, nextThreadId),
              );
            },
            (event) => {
              const consumedIds = resolveFollowUpConsumedIds(event);
              if (event?.mode === 'steer') {
                flushSteerFollowUps(consumedIds, event?.visibleAt ?? null);
                shouldStartFreshAssistantMessageAfterSteerRef.current = true;
                return;
              }

              removePendingFollowUps(consumedIds);
            },
            () => {
              const shouldStartFreshAssistant =
                shouldStartFreshAssistantMessageAfterSteerRef.current;
              shouldStartFreshAssistantMessageAfterSteerRef.current = false;
              return shouldStartFreshAssistant;
            },
            () => todosRef.current,
            (snapshot) => {
              updateTodos(snapshot);
            },
            handleRuntimeActivityTrigger,
            (goal) => {
              if (goal.threadId === nextThreadId) {
                setThreadGoal(goal);
              }
            },
            (goalThreadId) => {
              if (goalThreadId === nextThreadId) {
                setThreadGoal(null);
              }
            },
            (event) => {
              setThreadGoal((previous) => {
                if (!previous) {
                  return previous;
                }
                if (event.threadId && event.threadId !== nextThreadId) {
                  return previous;
                }
                if (
                  event.goalId &&
                  previous.id &&
                  event.goalId !== previous.id
                ) {
                  return previous;
                }
                return {
                  ...previous,
                  ...event.goal,
                  threadId: event.goal.threadId ?? previous.threadId,
                  objective: event.goal.objective ?? previous.objective,
                  status: event.goal.status,
                };
              });
            },
            preservedMessages,
            (id) => {
              updateConversationId(id);
              refreshConversationProject();
            },
            (status) => {
              setInterruptedThreadId(
                status === 'interrupted' ? nextThreadId : null,
              );
              pauseRequestedRef.current =
                status === 'pausing' || status === 'paused';
            },
          );
        }

        if (interrupts.length > 0 && !pauseRequestedRef.current) {
          for await (const interruptData of interrupts) {
            if (
              abortController.signal.aborted ||
              abortRef.current !== abortController
            )
              break;
            setInterruptedThreadId(nextThreadId);
            await handleInterrupt(interruptData);
          }
        }
      } catch (streamError) {
        if (
          abortRef.current === abortController &&
          !shouldIgnoreStreamError(streamError, abortController.signal)
        ) {
          transportError = streamError;
          setError(streamError);
        }
      } finally {
        const activeConversationId = conversationIdRef.current?.trim();
        if (
          activeConversationId &&
          abortRef.current === abortController &&
          (!options?.joinExistingThread || streamCompleted)
        ) {
          const reconciled = await reconcileLatestAssistantMessage(
            activeConversationId,
            nextThreadId,
            abortController.signal,
            runId,
          );
          if (reconciled && transportError && !abortController.signal.aborted) {
            setError(null);
          }
        }
        // A previous stream can finish after a thread switch starts another run.
        if (abortRef.current === abortController) {
          abortRef.current = null;
          shouldStartFreshAssistantMessageAfterSteerRef.current = false;
          const staleSteerIds = getPendingSteerFollowUpIds(
            pendingFollowUpsRef.current,
            steerPriorityFollowUpIdsRef.current,
          );
          if (staleSteerIds.length > 0) {
            markPendingFollowUpsAsQueued(staleSteerIds, {
              autoDrain: true,
              queuedFromSteer: true,
            });
          }
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      }
      if (options?.onRunAccepted && !runAccepted) {
        throw (
          transportError ?? new Error('The server did not acknowledge the run.')
        );
      }
    },
    [
      assistantId,
      additionalContext,
      client,
      streamSendEvent,
      projectId,
      conversationProject.projectId,
      conversationProject.fromHistory,
      handleInterrupt,
      projectSelection,
      flushSteerFollowUps,
      markPendingFollowUpsAsQueued,
      removePendingFollowUps,
      updateTodos,
      handleRuntimeActivityTrigger,
      updateConversationId,
      reconcileLatestAssistantMessage,
      refreshConversationProject,
      rememberActiveRunId,
    ],
  );
  return { runStream };
}
