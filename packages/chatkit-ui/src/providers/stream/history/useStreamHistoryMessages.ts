import type { ThreadDisplayPause } from '@xpert-ai/xpert-sdk';
import type { Thread } from '@xpert-ai/xpert-sdk';
import { useCallback } from 'react';
import {
  getAutoDrainQueuedFollowUpIds,
  type PendingFollowUp,
} from '../../../lib/follow-ups';
import { parsePausedDisplaySnapshot } from '../../../lib/paused-display-snapshot';
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
  STREAM_RECONCILIATION_MAX_CONSECUTIVE_FAILURES,
  waitForAbortableDelay,
} from './reconciliation';

type StreamHistoryMessagesOptions = Pick<
  ReturnType<typeof useStreamCredentials>,
  'ensureHistoryCredentials' | 'client'
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
    | 'setPausedDisplay'
    | 'rememberActiveRunId'
    | 'pauseRequestedRef'
    | 'pausedDisplayRef'
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
  conversationIdRef,
  hydrateResumedRootExecutions,
  steerPriorityFollowUpIdsRef,
  autoQueuedFollowUpIdsRef,
  pendingFollowUpsRef,
  setAutoQueuedFollowUpIds,
  setPendingFollowUps,
  setPausedDisplay,
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
  pausedDisplayRef,
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
      displayPause?: ThreadDisplayPause | null,
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
      const protocolDisplay =
        displayPause !== undefined
          ? displayPause
          : loadedThreadId
            ? (await client.threads.get(loadedThreadId)).displayPause
            : null;
      if (!request.isCurrent() || conversationIdRef.current !== recordId)
        return [];
      if (protocolDisplay?.snapshot && loadedThreadId) {
        setPausedDisplay({
          threadId: loadedThreadId,
          pause: protocolDisplay,
          values: parsePausedDisplaySnapshot(protocolDisplay.snapshot),
        });
      } else {
        setPausedDisplay(null);
      }
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
    if (
      pausedDisplayRef.current ||
      !recordId ||
      !pagination.hasMore ||
      pagination.isLoadingMore
    ) {
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
    ) => {
      let consecutiveFailures = 0;
      for (
        let attempt = 0;
        attempt < STREAM_RECONCILIATION_MAX_ATTEMPTS && !signal.aborted;
        attempt += 1
      ) {
        try {
          const [conversation, response, thread] = await Promise.all([
            client.conversations.get(recordId),
            client.conversations.searchMessages(recordId, {
              where: { role: 'ai', threadId: requestedThreadId },
              order: { createdAt: 'DESC' },
              limit: 1,
              offset: 0,
            }),
            client.threads.get(requestedThreadId),
          ]);
          if (
            signal.aborted ||
            conversationIdRef.current !== recordId ||
            activeThreadIdRef.current !== requestedThreadId
          ) {
            return false;
          }

          consecutiveFailures = 0;
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
          if (page.messages.length > 0) {
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
          if (status !== 'busy' && status !== 'running') {
            if (status === 'error') {
              if (
                conversation.threadId === requestedThreadId &&
                conversation.error
              ) {
                setError(new Error(conversation.error));
              }
              return false;
            }
            setHistoryMessageLoadVersion((version) => version + 1);
            return true;
          }
        } catch (reconciliationError) {
          consecutiveFailures += 1;
          if (
            (consecutiveFailures >=
              STREAM_RECONCILIATION_MAX_CONSECUTIVE_FAILURES ||
              attempt === STREAM_RECONCILIATION_MAX_ATTEMPTS - 1) &&
            !signal.aborted
          ) {
            console.warn(
              '[chatkit-ui] Failed to reconcile the completed assistant message',
              reconciliationError,
            );
            if (
              conversationIdRef.current === recordId &&
              activeThreadIdRef.current === requestedThreadId
            ) {
              setError(reconciliationError);
            }
            return false;
          }
        }

        await waitForAbortableDelay(signal, STREAM_RECONCILIATION_INTERVAL_MS);
      }
      return false;
    },
    [
      client,
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
