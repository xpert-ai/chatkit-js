import type { ReadRecovery } from '../connection/read-recovery';
import type { Thread } from '@xpert-ai/xpert-sdk';
import { useCallback } from 'react';
import {
  getAutoDrainQueuedFollowUpIds,
  type PendingFollowUp,
} from '../../../lib/follow-ups';
import type { createResumedRootExecutionHydrator } from '../../../lib/resumed-root-executions';
import type { useRuntimeActivities } from '../../runtime-activities';
import type { HistoryRequest } from '../../useThreadHistory';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import { mergePendingFollowUps } from '../follow-ups/merge';
import type { useStreamFollowUpState } from '../follow-ups/useStreamFollowUpState';
import type { useStreamHost } from '../host/useStreamHost';
import type { useStreamInterrupts } from '../interrupts/useStreamInterrupts';
import {
  getLatestExecutionIdFromMessages,
  isLiveThreadRunStatus,
  upsertMessages,
} from '../messages/reducer';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunControl } from '../runs/useStreamRunControl';
import type { useStreamRunState } from '../runs/useStreamRunState';
import {
  getConversationThreadId,
  normalizeThreadIdentifier,
} from '../scope/thread-identity';
import type { useStreamScope } from '../scope/useStreamScope';
import type { ChatKitAIMessage, StateType } from '../types';
import {
  createConversationMessagesPageQuery,
  createEmptyHistoryMessagePagination,
  mergeHistoryUiMessages,
  normalizeConversationMessagesPage,
} from './pagination';
import {
  STREAM_RECONCILIATION_INTERVAL_MS,
  STREAM_RECONCILIATION_MAX_ATTEMPTS,
  waitForAbortableDelay,
} from './reconciliation';

type StreamHistoryMessagesOptions = Pick<
  ReturnType<typeof useStreamCredentials>,
  'ensureHistoryCredentials' | 'client' | 'readClient'
> &
  Pick<ReturnType<typeof useStreamRunControl>, 'disconnect'> &
  Pick<
    ReturnType<typeof useStreamMessages>,
    | 'updateTodos'
    | 'updateHistoryMessagePagination'
    | 'valuesRef'
    | 'setValues'
    | 'setHistoryMessageLoadVersion'
    | 'historyMessagePaginationRef'
  > &
  Pick<
    ReturnType<typeof useStreamScope>,
    | 'activeThreadIdRef'
    | 'updateConversationId'
    | 'conversationIdRef'
    | 'setThreadId'
  > &
  Pick<
    ReturnType<typeof useRuntimeActivities<StateType>>,
    'clearRuntimeActivities'
  > &
  Pick<
    ReturnType<typeof useStreamFollowUpState>,
    | 'steerPriorityFollowUpIdsRef'
    | 'autoQueuedFollowUpIdsRef'
    | 'pendingFollowUpsRef'
    | 'setAutoQueuedFollowUpIds'
    | 'setPendingFollowUps'
    | 'addAutoQueuedFollowUpIds'
  > &
  Pick<
    ReturnType<typeof useStreamRunState>,
    | 'rememberActiveRunId'
    | 'pauseRequestedRef'
    | 'setInterruptedThreadId'
    | 'setError'
  > &
  Pick<
    ReturnType<typeof useStreamInterrupts>,
    'hydratePendingHITLRequestFromOperation'
  > &
  Pick<
    ReturnType<typeof useStreamHost>,
    'loadHistory' | 'captureHistoryRequest'
  > & {
    recovery: ReadRecovery;
    hydrateResumedRootExecutions: ReturnType<
      typeof createResumedRootExecutionHydrator
    >;
  };

export function useStreamHistoryMessages({
  ensureHistoryCredentials,
  disconnect,
  updateTodos,
  activeThreadIdRef,
  clearRuntimeActivities,
  updateConversationId,
  updateHistoryMessagePagination,
  client,
  readClient,
  recovery,
  conversationIdRef,
  hydrateResumedRootExecutions,
  steerPriorityFollowUpIdsRef,
  autoQueuedFollowUpIdsRef,
  pendingFollowUpsRef,
  setAutoQueuedFollowUpIds,
  setPendingFollowUps,
  rememberActiveRunId,
  setThreadId,
  valuesRef,
  setValues,
  setHistoryMessageLoadVersion,
  pauseRequestedRef,
  hydratePendingHITLRequestFromOperation,
  loadHistory,
  captureHistoryRequest,
  historyMessagePaginationRef,
  addAutoQueuedFollowUpIds,
  setInterruptedThreadId,
  setError,
}: StreamHistoryMessagesOptions) {
  const readConversationMessages = useCallback(
    async (
      recordId: string,
      requestedThreadId: string | undefined,
      request: HistoryRequest,
      threadOperation?: Thread['operation'],
    ) => {
      await ensureHistoryCredentials();
      if (!request.isCurrent()) return [];
      try {
        disconnect();
      } catch {
        // ignore stop errors from an already-idle stream
      }
      updateTodos(null);
      activeThreadIdRef.current = null;
      clearRuntimeActivities();
      updateConversationId(recordId);
      updateHistoryMessagePagination({
        ...createEmptyHistoryMessagePagination(),
        conversationId: recordId,
        threadId: requestedThreadId ?? null,
      });
      const [conversationDetail, response] = await Promise.all([
        client.conversations.get(recordId).catch((detailError) => {
          console.warn(
            '[chatkit-ui] Failed to load conversation detail for pending HITL',
            detailError,
          );
          return null;
        }),
        client.conversations.searchMessages(recordId, {
          ...createConversationMessagesPageQuery(0),
          ...(requestedThreadId
            ? { where: { threadId: requestedThreadId } }
            : {}),
        }),
      ]);
      if (!request.isCurrent() || conversationIdRef.current !== recordId) {
        return [];
      }
      const loadedThreadId =
        normalizeThreadIdentifier(requestedThreadId) ??
        getConversationThreadId(conversationDetail);
      const page = normalizeConversationMessagesPage(response);
      page.messages = await hydrateResumedRootExecutions(
        page.messages,
        loadedThreadId,
      );
      if (!request.isCurrent() || conversationIdRef.current !== recordId)
        return [];
      steerPriorityFollowUpIdsRef.current = new Set();
      const autoDrainIds = getAutoDrainQueuedFollowUpIds(page.pendingFollowUps);
      autoQueuedFollowUpIdsRef.current = new Set(autoDrainIds);
      pendingFollowUpsRef.current = page.pendingFollowUps;
      setAutoQueuedFollowUpIds(autoDrainIds);
      setPendingFollowUps(page.pendingFollowUps);
      const latestExecutionId = getLatestExecutionIdFromMessages(page.messages);
      if (
        isLiveThreadRunStatus(conversationDetail?.status) &&
        latestExecutionId
      ) {
        rememberActiveRunId(latestExecutionId);
      } else {
        rememberActiveRunId(null);
      }
      if (loadedThreadId) {
        activeThreadIdRef.current = loadedThreadId;
        setThreadId(loadedThreadId);
      }
      updateHistoryMessagePagination({
        conversationId: recordId,
        threadId: loadedThreadId,
        loadedCount: page.loadedCount,
        total: page.total,
        hasMore: page.hasMore,
        isLoadingMore: false,
      });
      valuesRef.current = { messages: page.messages ?? [] };
      setValues(valuesRef.current);
      setHistoryMessageLoadVersion((version) => version + 1);
      if (!pauseRequestedRef.current)
        hydratePendingHITLRequestFromOperation(
          threadOperation !== undefined
            ? threadOperation
            : conversationDetail?.operation,
          latestExecutionId,
        );
      return page.messages as ChatKitAIMessage[];
    },
    [
      clearRuntimeActivities,
      client,
      ensureHistoryCredentials,
      hydratePendingHITLRequestFromOperation,
      hydrateResumedRootExecutions,
      rememberActiveRunId,
      setThreadId,
      disconnect,
      updateConversationId,
      updateHistoryMessagePagination,
      updateTodos,
    ],
  );

  const loadConversationMessages = useCallback(
    async (recordId: string, requestedThreadId?: string) => {
      let messages: ChatKitAIMessage[] | undefined;
      await loadHistory(requestedThreadId ?? recordId, async (request) => {
        messages = await readConversationMessages(
          recordId,
          requestedThreadId,
          request,
        );
      });
      return (
        messages ??
        (conversationIdRef.current === recordId &&
        (!requestedThreadId || activeThreadIdRef.current === requestedThreadId)
          ? (valuesRef.current.messages ?? [])
          : [])
      );
    },
    [loadHistory, readConversationMessages],
  );

  const loadMoreConversationMessages = useCallback(async () => {
    const request = captureHistoryRequest();
    const pagination = historyMessagePaginationRef.current;
    const recordId = pagination.conversationId;
    if (!recordId || !pagination.hasMore || pagination.isLoadingMore) {
      return [];
    }

    updateHistoryMessagePagination((previous) =>
      previous.conversationId === recordId
        ? { ...previous, isLoadingMore: true }
        : previous,
    );

    try {
      await ensureHistoryCredentials();
      if (!request.isCurrent()) return [];
      const response = await client.conversations.searchMessages(recordId, {
        ...createConversationMessagesPageQuery(pagination.loadedCount),
        ...(pagination.threadId
          ? { where: { threadId: pagination.threadId } }
          : {}),
      });
      const page = normalizeConversationMessagesPage(
        response,
        pagination.loadedCount,
      );
      page.messages = await hydrateResumedRootExecutions(
        page.messages,
        pagination.threadId,
      );

      if (!request.isCurrent()) return [];
      if (conversationIdRef.current !== recordId) {
        updateHistoryMessagePagination((previous) =>
          previous.conversationId === recordId
            ? { ...previous, isLoadingMore: false }
            : previous,
        );
        return [];
      }

      if (page.pendingFollowUps.length > 0) {
        const mergeLoadedPendingFollowUps = (previous: PendingFollowUp[]) =>
          mergePendingFollowUps(previous, page.pendingFollowUps);
        pendingFollowUpsRef.current = mergeLoadedPendingFollowUps(
          pendingFollowUpsRef.current,
        );
        setPendingFollowUps((previous) =>
          mergeLoadedPendingFollowUps(previous),
        );
        addAutoQueuedFollowUpIds(
          getAutoDrainQueuedFollowUpIds(page.pendingFollowUps),
        );
      }

      setValues((previous) => ({
        ...previous,
        messages: mergeHistoryUiMessages(
          previous.messages ?? [],
          page.messages,
        ),
      }));
      updateHistoryMessagePagination((previous) =>
        previous.conversationId === recordId
          ? {
              conversationId: recordId,
              threadId: pagination.threadId,
              loadedCount: page.loadedCount,
              total: page.total,
              hasMore: page.hasMore,
              isLoadingMore: false,
            }
          : previous,
      );
      setHistoryMessageLoadVersion((version) => version + 1);
      return page.messages as ChatKitAIMessage[];
    } catch (error) {
      if (!request.isCurrent()) return [];
      updateHistoryMessagePagination((previous) =>
        previous.conversationId === recordId
          ? { ...previous, isLoadingMore: false }
          : previous,
      );
      throw error;
    }
  }, [
    addAutoQueuedFollowUpIds,
    captureHistoryRequest,
    hydrateResumedRootExecutions,
    client,
    ensureHistoryCredentials,
    updateHistoryMessagePagination,
  ]);

  const reconcileLatestAssistantMessage = useCallback(
    async (
      recordId: string,
      requestedThreadId: string,
      signal: AbortSignal,
      executionId?: string,
    ) => {
      for (
        let attempt = 0;
        attempt < STREAM_RECONCILIATION_MAX_ATTEMPTS &&
        !signal.aborted &&
        !recovery.stopped;
        attempt += 1
      ) {
        try {
          const results = await Promise.allSettled([
            recovery.read(
              `conversation:${recordId}`,
              (signal) => readClient.conversations.get(recordId, { signal }),
              signal,
            ),
            recovery.read(
              `latest:${executionId ?? requestedThreadId}`,
              (signal) =>
                readClient.conversations.searchMessages(
                  recordId,
                  {
                    where: {
                      role: 'ai',
                      threadId: requestedThreadId,
                      ...(executionId ? { executionId } : {}),
                    },
                    order: { createdAt: 'DESC' },
                    limit: executionId ? 100 : 1,
                    offset: 0,
                  },
                  { signal },
                ),
              signal,
            ),
            recovery.read(
              `thread:${requestedThreadId}`,
              (signal) => readClient.threads.get(requestedThreadId, { signal }),
              signal,
            ),
            executionId
              ? recovery.read(
                  `status:${executionId}`,
                  (signal) =>
                    readClient.runs.get(requestedThreadId, executionId, {
                      signal,
                    }),
                  signal,
                )
              : Promise.resolve(null),
          ]);
          if (
            signal.aborted ||
            conversationIdRef.current !== recordId ||
            activeThreadIdRef.current !== requestedThreadId
          ) {
            return false;
          }

          const [conversationResult, responseResult, threadResult, runResult] =
            results;
          // A confirmed terminal run can publish its final message even if another metadata read failed.
          if (
            responseResult.status === 'fulfilled' &&
            runResult.status === 'fulfilled' &&
            runResult.value?.run_id === executionId &&
            runResult.value?.thread_id === requestedThreadId &&
            !['pending', 'running'].includes(runResult.value.status)
          ) {
            const finalPage = normalizeConversationMessagesPage(
              responseResult.value,
            );
            setValues((previous) => ({
              ...previous,
              messages: upsertMessages(previous.messages, finalPage.messages),
            }));
          }
          if (conversationResult.status === 'rejected')
            throw conversationResult.reason;
          if (threadResult.status === 'rejected') throw threadResult.reason;
          if (runResult.status === 'rejected') throw runResult.reason;
          if (responseResult.status === 'rejected') throw responseResult.reason;
          const conversation = conversationResult.value,
            response = responseResult.value,
            thread = threadResult.value,
            run = runResult.value;
          const page = normalizeConversationMessagesPage(response);
          page.messages = await hydrateResumedRootExecutions(
            page.messages,
            requestedThreadId,
          );
          if (
            signal.aborted ||
            conversationIdRef.current !== recordId ||
            activeThreadIdRef.current !== requestedThreadId
          )
            return false;
          const stillRunning = executionId
            ? ['pending', 'running'].includes(run?.status ?? '')
            : ['busy', 'running'].includes(
                thread.status ?? conversation.status ?? '',
              );
          if (page.messages.length > 0 && !stillRunning) {
            setValues((previous) => ({
              ...previous,
              messages: upsertMessages(
                previous.messages ?? [],
                page.messages as ChatKitAIMessage[],
              ),
            }));
          }

          const status = String(
            thread.status ?? conversation.status ?? '',
          ).toLowerCase();
          const interrupted = status === 'interrupted';
          // An interruption can mean cancellation or human input. Neither
          // keeps a completed transport alive or starts automatic polling.
          setInterruptedThreadId(interrupted ? requestedThreadId : null);
          if (!pauseRequestedRef.current) {
            hydratePendingHITLRequestFromOperation(
              interrupted
                ? thread.operation !== undefined
                  ? thread.operation
                  : conversation.threadId === requestedThreadId
                    ? conversation.operation
                    : null
                : null,
              getLatestExecutionIdFromMessages(page.messages),
            );
          }
          const isRequestedRun =
            Boolean(executionId) &&
            run?.run_id === executionId &&
            run?.thread_id === requestedThreadId;
          const runIsPending =
            isRequestedRun &&
            (run?.status === 'pending' || run?.status === 'running');
          if (runIsPending && recovery.getSnapshot() !== 'connected')
            return false;
          if (isRequestedRun && !runIsPending)
            recovery.succeeded(`run:${executionId}`);
          if (
            executionId
              ? !runIsPending
              : status !== 'busy' && status !== 'running'
          ) {
            if (!executionId && status === 'error') {
              if (
                conversation.threadId === requestedThreadId &&
                conversation.error
              ) {
                setError(new Error(conversation.error));
              }
              return false;
            }
            setHistoryMessageLoadVersion((version) => version + 1);
            // History hydration and recovery of this submission are separate facts.
            // A thread can be idle after a rejected request, with only older messages.
            return isRequestedRun && run?.status === 'success';
          }
        } catch {
          // ReadRecovery records availability and owns the next attempt time. Do not change run status.
          if (signal.aborted || recovery.stopped) return false;
        }

        await waitForAbortableDelay(signal, STREAM_RECONCILIATION_INTERVAL_MS);
      }
      return false;
    },
    [
      client,
      readClient,
      recovery,
      hydrateResumedRootExecutions,
      hydratePendingHITLRequestFromOperation,
      setInterruptedThreadId,
      setError,
    ],
  );
  return {
    reconcileLatestAssistantMessage,
    readConversationMessages,
    loadConversationMessages,
    loadMoreConversationMessages,
  };
}
