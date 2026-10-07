import { useCallback, useEffect } from 'react';
import { getConversationConnectorBindingIds } from '../../../lib/conversation-connectors';
import { createConversationThreadSearchWhere } from '../../../lib/conversation-runtime-capabilities';
import { waitForActiveThreadRunId } from '../../../lib/thread-runs';
import type { useRuntimeActivities } from '../../runtime-activities';
import type { useConversationProject } from '../../useConversationProject';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import { isRecord } from '../events/envelope';
import type { useStreamFollowUpState } from '../follow-ups/useStreamFollowUpState';
import type { useStreamHost } from '../host/useStreamHost';
import type { useStreamInterrupts } from '../interrupts/useStreamInterrupts';
import {
  getLatestExecutionIdFromMessages,
  isLiveThreadRunStatus,
} from '../messages/reducer';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunControl } from '../runs/useStreamRunControl';
import type { useStreamRunState } from '../runs/useStreamRunState';
import { normalizeThreadIdentifier } from '../scope/thread-identity';
import type { useStreamScope } from '../scope/useStreamScope';
import type { useStreamTransport } from '../transport/useStreamTransport';
import type { ChatKitAIMessage, StateType } from '../types';
import { createEmptyHistoryMessagePagination } from './pagination';
import type { useStreamHistoryMessages } from './useStreamHistoryMessages';

type StreamThreadLoadingOptions = Pick<
  ReturnType<typeof useStreamScope>,
  | 'activeThreadIdRef'
  | 'setThreadId'
  | 'updateConversationId'
  | 'updateConnectorBindingIdsState'
  | 'initialSelectedThreadRef'
  | 'consumedInitialThreadRef'
> &
  Pick<
    ReturnType<typeof useStreamRunState>,
    | 'isLoadingRef'
    | 'setError'
    | 'setInterruptedThreadId'
    | 'lastEventIdRef'
    | 'pauseRequestedRef'
    | 'rememberActiveRunId'
  > &
  Pick<ReturnType<typeof useStreamHost>, 'loadHistory' | 'isParentAvailable'> &
  Pick<
    ReturnType<typeof useStreamMessages>,
    'updateTodos' | 'valuesRef' | 'setValues' | 'updateHistoryMessagePagination'
  > &
  Pick<
    ReturnType<typeof useRuntimeActivities<StateType>>,
    'clearRuntimeActivities' | 'refreshSandboxServices'
  > &
  Pick<ReturnType<typeof useStreamRunControl>, 'disconnect'> &
  Pick<
    ReturnType<typeof useStreamCredentials>,
    | 'ensureHistoryCredentials'
    | 'client'
    | 'runtimeClientSecretRef'
    | 'runtimeClientSecret'
  > &
  Pick<ReturnType<typeof useStreamFollowUpState>, 'setPendingFollowUps'> &
  Pick<
    ReturnType<typeof useStreamHistoryMessages>,
    'readConversationMessages'
  > &
  Pick<
    ReturnType<typeof useStreamInterrupts>,
    'hydratePendingHITLRequestFromOperation'
  > &
  Pick<ReturnType<typeof useStreamTransport>, 'runStream'> & {
    assistantId: string;
    hydrateConversationProject: ReturnType<
      typeof useConversationProject
    >['hydrate'];
    projectId: string | undefined;
    initialThread: string | null | undefined;
    apiUrl: string;
  };

export function useStreamThreadLoading({
  activeThreadIdRef,
  isLoadingRef,
  loadHistory,
  setError,
  setInterruptedThreadId,
  updateTodos,
  clearRuntimeActivities,
  valuesRef,
  setValues,
  disconnect,
  setThreadId,
  lastEventIdRef,
  ensureHistoryCredentials,
  client,
  pauseRequestedRef,
  assistantId,
  updateConversationId,
  updateConnectorBindingIdsState,
  setPendingFollowUps,
  updateHistoryMessagePagination,
  hydrateConversationProject,
  readConversationMessages,
  refreshSandboxServices,
  rememberActiveRunId,
  hydratePendingHITLRequestFromOperation,
  runStream,
  projectId,
  initialThread,
  initialSelectedThreadRef,
  consumedInitialThreadRef,
  apiUrl,
  runtimeClientSecretRef,
  isParentAvailable,
  runtimeClientSecret,
}: StreamThreadLoadingOptions) {
  const loadThread = useCallback(
    async (threadId: string) => {
      if (!threadId) return;
      if (threadId === activeThreadIdRef.current && isLoadingRef.current) {
        return;
      }
      return loadHistory(threadId, async (request) => {
        setError(null);

        updateTodos(null);
        clearRuntimeActivities();
        if (activeThreadIdRef.current !== threadId) {
          valuesRef.current = { messages: [] };
          setValues(valuesRef.current);
        }

        try {
          disconnect();
        } catch {
          // ignore stop errors from an already-idle stream
        }

        setThreadId(threadId);
        activeThreadIdRef.current = threadId;
        lastEventIdRef.current = null;

        await ensureHistoryCredentials();
        if (!request.isCurrent()) return;
        const protocolThread = await client.threads
          .get(threadId)
          .catch(() => null);
        if (!request.isCurrent()) return;
        pauseRequestedRef.current =
          protocolThread?.status === 'paused' ||
          protocolThread?.status === 'pausing';
        const protocolMetadata = isRecord(protocolThread?.metadata)
          ? protocolThread.metadata
          : null;
        const protocolConversationId =
          typeof protocolMetadata?.id === 'string'
            ? protocolMetadata.id.trim()
            : '';
        const conversationResult = protocolConversationId
          ? null
          : await client.conversations.search({
              where: createConversationThreadSearchWhere(threadId, {
                xpertId: assistantId,
              }),
              limit: 1,
            });

        if (!request.isCurrent()) return;
        const conversation = protocolConversationId
          ? await client.conversations.get(protocolConversationId)
          : conversationResult?.items?.[0];
        if (!request.isCurrent()) return;
        if (!conversation?.id) {
          updateConversationId(null);
          updateConnectorBindingIdsState([]);
          setPendingFollowUps([]);
          updateHistoryMessagePagination(createEmptyHistoryMessagePagination());
          setValues({ messages: [] });
          return;
        }

        let conversationDetail = conversation;
        if (
          String(conversation.status ?? '').toLowerCase() === 'interrupted' &&
          (conversation as { operation?: unknown }).operation == null
        ) {
          try {
            conversationDetail = await client.conversations.get(
              conversation.id,
            );
          } catch (detailError) {
            console.warn(
              '[chatkit-ui] Failed to load conversation detail for pending HITL',
              detailError,
            );
          }
        }

        if (!request.isCurrent()) return;
        updateConversationId(conversation.id);
        hydrateConversationProject(conversationDetail, threadId);
        updateConnectorBindingIdsState(
          getConversationConnectorBindingIds(conversationDetail),
        );
        const loadedMessages = await readConversationMessages(
          conversation.id,
          threadId,
          request,
          protocolThread?.operation,
        );
        if (!request.isCurrent()) return;
        // Service discovery owns its loading/error state and must not gate views.
        void refreshSandboxServices({
          targetThreadId: threadId,
          force: true,
        })?.catch((servicesError) => {
          console.warn(
            '[chatkit-ui] Background sandbox service refresh failed',
            servicesError,
          );
        });
        if (!request.isCurrent()) return;
        const latestExecutionId = getLatestExecutionIdFromMessages(
          loadedMessages as ChatKitAIMessage[],
        );
        if (
          isLiveThreadRunStatus(protocolThread?.status) &&
          latestExecutionId
        ) {
          rememberActiveRunId(latestExecutionId);
        } else {
          rememberActiveRunId(null);
        }
        const hasPendingHITL =
          !pauseRequestedRef.current &&
          hydratePendingHITLRequestFromOperation(
            protocolThread?.operation !== undefined
              ? protocolThread.operation
              : conversationDetail.operation,
            latestExecutionId,
          );
        const status = String(
          protocolThread?.status ??
            conversationDetail.status ??
            conversation.status ??
            '',
        ).toLowerCase();
        setInterruptedThreadId(status === 'interrupted' ? threadId : null);
        // Restore human interactions without reviving cancelled or historical
        // interrupted runs. Ordinary long tasks remain busy and rejoin below.
        if (status === 'interrupted' || status === 'paused' || hasPendingHITL)
          return;
        const conversationMayBeRunning =
          !status ||
          status === 'running' ||
          status === 'busy' ||
          status === 'pausing';

        let runId: string | null = null;
        let runLookupFailed = false;
        try {
          runId = await waitForActiveThreadRunId(
            () => client.runs.list(threadId, { limit: 100 }),
            {
              attempts: conversationMayBeRunning ? 20 : 1,
              shouldContinue: () =>
                request.isCurrent() && activeThreadIdRef.current === threadId,
            },
          );
        } catch (runsError) {
          console.warn(
            '[chatkit-ui] Failed to resolve the active execution from thread runs',
            runsError,
          );
          runLookupFailed = true;
        }

        if (!request.isCurrent()) return;
        // Compatibility fallback for completed or legacy conversations whose
        // execution can only be recovered from a persisted assistant message.
        if (!runId && runLookupFailed && conversationMayBeRunning) {
          const lastAiMessageResult = await client.conversations.searchMessages(
            conversation.id,
            {
              where: { role: 'ai', threadId },
              order: { createdAt: 'DESC' },
              limit: 1,
            },
          );
          runId = lastAiMessageResult.items?.[0]?.executionId ?? null;
        }
        if (!request.isCurrent() || !runId) return;
        if (activeThreadIdRef.current !== threadId) return;
        rememberActiveRunId(runId);

        // History is ready; a resumed stream must not keep the load request pending.
        void runStream(threadId, null, { joinExistingThread: true }, runId);
      });
    },
    [
      assistantId,
      client,
      ensureHistoryCredentials,
      hydrateConversationProject,
      projectId,
      runStream,
      disconnect,
      readConversationMessages,
      setInterruptedThreadId,
      loadHistory,
      hydratePendingHITLRequestFromOperation,
      clearRuntimeActivities,
      refreshSandboxServices,
      setThreadId,
      updateConversationId,
      updateConnectorBindingIdsState,
      updateHistoryMessagePagination,
      updateTodos,
      rememberActiveRunId,
    ],
  );

  useEffect(() => {
    const requestedInitialThread = normalizeThreadIdentifier(
      initialThread ?? initialSelectedThreadRef.current,
    );
    if (!requestedInitialThread) {
      consumedInitialThreadRef.current = null;
      return;
    }
    if (consumedInitialThreadRef.current === requestedInitialThread) return;
    if (
      !apiUrl.trim() ||
      (!runtimeClientSecretRef.current.trim() && !isParentAvailable)
    )
      return;

    consumedInitialThreadRef.current = requestedInitialThread;
    // A newly submitted live thread already owns its transcript. All other
    // initial selections need a history load, even when their IDs match.
    if (
      requestedInitialThread === activeThreadIdRef.current &&
      isLoadingRef.current
    )
      return;
    void loadThread(requestedInitialThread).catch(() => {
      // The history state exposes this failure and permits an explicit retry.
    });
  }, [
    apiUrl,
    initialThread,
    isParentAvailable,
    loadThread,
    runtimeClientSecret,
  ]);
  return { loadThread };
}
