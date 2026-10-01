import type { TChatRequest } from '@xpert-ai/chatkit-types';
import type { Config } from '@xpert-ai/xpert-sdk';
import { useCallback, useEffect, useMemo } from 'react';
import { createConversationThreadSearchWhere } from '../../../lib/conversation-runtime-capabilities';
import {
  buildSteerFollowUpRunInput,
  getNextAutoQueuedFollowUp,
  getQueuedFollowUpGroup,
  mergeQueuedFollowUpGroup,
  movePendingFollowUpBeforeQueuedItems,
  toQueuedSendRequest,
  type PendingFollowUp,
} from '../../../lib/follow-ups';
import { normalizeRequestContextAndConfig } from '../../../lib/request-options';
import type { useStreamCredentials } from '../auth/useStreamCredentials';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunState } from '../runs/useStreamRunState';
import type { useStreamScope } from '../scope/useStreamScope';
import { mergeStreamRequestContext } from '../transport/request-options';
import type { StreamSubmitOptions } from '../types';
import type { useStreamFollowUpState } from './useStreamFollowUpState';

type StreamFollowUpsOptions = Pick<
  ReturnType<typeof useStreamScope>,
  | 'conversationIdRef'
  | 'updateConversationId'
  | 'activeThreadIdRef'
  | 'threadId'
> &
  Pick<ReturnType<typeof useStreamCredentials>, 'client'> &
  Pick<
    ReturnType<typeof useStreamRunState>,
    | 'lastExecutionIdRef'
    | 'isLoadingRef'
    | 'setError'
    | 'pauseRequestedRef'
    | 'pausedDisplayRef'
    | 'submitRef'
    | 'isLoading'
  > &
  Pick<ReturnType<typeof useStreamMessages>, 'valuesRef'> &
  Pick<
    ReturnType<typeof useStreamFollowUpState>,
    | 'pendingFollowUpsRef'
    | 'removeAutoQueuedFollowUpIds'
    | 'addSteerPriorityFollowUpIds'
    | 'setPendingFollowUps'
    | 'markPendingFollowUpsAsQueued'
    | 'autoQueuedFollowUpIds'
    | 'removePendingFollowUps'
    | 'insertPendingFollowUpsIntoTranscript'
    | 'queueDrainPromiseRef'
    | 'autoQueuedFollowUpIdsRef'
    | 'steerPriorityFollowUpIdsRef'
  > & {
    assistantId: string;
    projectId: string | undefined;
    additionalContext: Record<string, unknown> | undefined;
  };

export function useStreamFollowUps({
  conversationIdRef,
  client,
  assistantId,
  updateConversationId,
  projectId,
  additionalContext,
  lastExecutionIdRef,
  valuesRef,
  isLoadingRef,
  pendingFollowUpsRef,
  removeAutoQueuedFollowUpIds,
  addSteerPriorityFollowUpIds,
  setPendingFollowUps,
  activeThreadIdRef,
  threadId,
  markPendingFollowUpsAsQueued,
  setError,
  autoQueuedFollowUpIds,
  pauseRequestedRef,
  pausedDisplayRef,
  removePendingFollowUps,
  insertPendingFollowUpsIntoTranscript,
  submitRef,
  queueDrainPromiseRef,
  autoQueuedFollowUpIdsRef,
  steerPriorityFollowUpIdsRef,
  isLoading,
}: StreamFollowUpsOptions) {
  const resolveConversationId = useCallback(
    async (nextThreadId: string) => {
      if (!nextThreadId) {
        return null;
      }

      const cachedConversationId = conversationIdRef.current?.trim();
      if (cachedConversationId) {
        return cachedConversationId;
      }

      const conversationResult = await client.conversations.search({
        where: createConversationThreadSearchWhere(nextThreadId, {
          xpertId: assistantId,
        }),
        limit: 1,
      });
      const conversationId = conversationResult.items?.[0]?.id?.trim() ?? null;
      updateConversationId(conversationId);
      return conversationId;
    },
    [assistantId, client, projectId, updateConversationId],
  );

  const sendSteerFollowUp = useCallback(
    async (
      nextThreadId: string,
      input: TChatRequest,
      options?: StreamSubmitOptions,
    ) => {
      const normalizedRequest = normalizeRequestContextAndConfig({
        context: mergeStreamRequestContext(options?.context, additionalContext),
        config: options?.config,
      });
      const conversationId = await resolveConversationId(nextThreadId);
      const explicitFollowUpInput = buildSteerFollowUpRunInput({
        request: input,
        conversationId,
        targetExecutionId:
          (typeof input.executionId === 'string' && input.executionId.trim()) ||
          lastExecutionIdRef.current,
        messages: valuesRef.current.messages ?? [],
      });

      if (!explicitFollowUpInput) {
        throw new Error('Missing conversation context for steer follow-up');
      }

      await client.runs.create(nextThreadId, assistantId, {
        input: explicitFollowUpInput,
        context: normalizedRequest.context,
        config: normalizedRequest.config as Config | undefined,
      });
    },
    [additionalContext, assistantId, client, resolveConversationId],
  );

  const promotePendingFollowUpToSteer = useCallback(
    async (id: string) => {
      if (!id || !isLoadingRef.current) {
        return;
      }

      const currentItem = pendingFollowUpsRef.current.find(
        (item) => item.id === id && item.mode === 'queue',
      );
      if (!currentItem) {
        return;
      }
      removeAutoQueuedFollowUpIds([id]);
      addSteerPriorityFollowUpIds([id]);

      const targetExecutionId =
        lastExecutionIdRef.current ??
        currentItem.request.executionId ??
        currentItem.targetExecutionId ??
        undefined;

      const nextRequest: TChatRequest = {
        ...currentItem.request,
        ...(targetExecutionId ? { executionId: targetExecutionId } : {}),
        followUpMode: 'steer',
      };

      const steerItem: PendingFollowUp = {
        ...currentItem,
        mode: 'steer',
        request: nextRequest,
        targetExecutionId: targetExecutionId ?? null,
        queuedFromSteer: true,
      };
      pendingFollowUpsRef.current = movePendingFollowUpBeforeQueuedItems(
        pendingFollowUpsRef.current,
        id,
        steerItem,
      );
      setPendingFollowUps((prev) =>
        movePendingFollowUpBeforeQueuedItems(prev, id, steerItem),
      );

      const activeThreadId = activeThreadIdRef.current ?? threadId ?? null;
      if (!activeThreadId) {
        markPendingFollowUpsAsQueued([id], {
          autoDrain: true,
          queuedFromSteer: true,
        });
        return;
      }

      try {
        await sendSteerFollowUp(activeThreadId, nextRequest, {
          ...(currentItem.context ? { context: currentItem.context } : {}),
          ...(currentItem.config ? { config: currentItem.config } : {}),
        });
      } catch (followUpError) {
        setError(followUpError);
        markPendingFollowUpsAsQueued([id], {
          autoDrain: true,
          queuedFromSteer: true,
        });
      }
    },
    [
      addSteerPriorityFollowUpIds,
      markPendingFollowUpsAsQueued,
      removeAutoQueuedFollowUpIds,
      sendSteerFollowUp,
      setError,
      threadId,
    ],
  );

  const autoQueuedFollowUpIdSet = useMemo(
    () => new Set(autoQueuedFollowUpIds),
    [autoQueuedFollowUpIds],
  );

  const canSendPendingFollowUpNow = useCallback(
    (id: string) => {
      if (
        !id ||
        isLoadingRef.current ||
        pauseRequestedRef.current ||
        pausedDisplayRef.current ||
        autoQueuedFollowUpIdSet.has(id)
      ) {
        return false;
      }

      return pendingFollowUpsRef.current.some(
        (item) => item.id === id && item.mode === 'queue',
      );
    },
    [autoQueuedFollowUpIdSet],
  );

  const sendPendingFollowUpNow = useCallback(
    async (id: string) => {
      if (
        !id ||
        isLoadingRef.current ||
        pauseRequestedRef.current ||
        pausedDisplayRef.current
      ) {
        return;
      }

      const nextItem = pendingFollowUpsRef.current.find(
        (item) => item.id === id && item.mode === 'queue',
      );
      if (!nextItem) {
        return;
      }

      const groupedItems = getQueuedFollowUpGroup(
        pendingFollowUpsRef.current,
        nextItem,
      );
      const mergedGroup = mergeQueuedFollowUpGroup(groupedItems, {
        leadItemId: id,
      });
      if (!mergedGroup) {
        return;
      }

      const target = activeThreadIdRef.current ?? threadId;
      if (target) {
        const current = await client.threads.get(target);
        if (
          activeThreadIdRef.current !== target ||
          current.status === 'pausing' ||
          current.status === 'paused'
        )
          return;
      }
      removePendingFollowUps(mergedGroup.items.map((item) => item.id));
      insertPendingFollowUpsIntoTranscript(mergedGroup.items);
      await submitRef.current?.(toQueuedSendRequest(mergedGroup.request), {
        ...(mergedGroup.context ? { context: mergedGroup.context } : {}),
        ...(mergedGroup.config ? { config: mergedGroup.config } : {}),
        threadId: activeThreadIdRef.current ?? threadId ?? undefined,
      });
    },
    [
      client,
      insertPendingFollowUpsIntoTranscript,
      removePendingFollowUps,
      threadId,
    ],
  );

  const drainQueuedFollowUps = useCallback(async () => {
    if (
      pausedDisplayRef.current ||
      queueDrainPromiseRef.current ||
      isLoadingRef.current
    ) {
      return queueDrainPromiseRef.current ?? Promise.resolve();
    }

    const drainPromise = (async () => {
      while (!isLoadingRef.current && !pausedDisplayRef.current) {
        const nextItem = getNextAutoQueuedFollowUp(
          pendingFollowUpsRef.current,
          autoQueuedFollowUpIdsRef.current,
          steerPriorityFollowUpIdsRef.current,
        );

        if (!nextItem) {
          break;
        }

        const targetThreadId = activeThreadIdRef.current ?? threadId;
        if (targetThreadId) {
          const current = await client.threads.get(targetThreadId);
          if (
            activeThreadIdRef.current !== targetThreadId ||
            current?.status === 'paused' ||
            current?.status === 'pausing'
          )
            break;
          if (
            pauseRequestedRef.current &&
            current?.status !== 'idle' &&
            current?.status !== 'error'
          )
            break;
          pauseRequestedRef.current = false;
        }

        const groupedItems = getQueuedFollowUpGroup(
          pendingFollowUpsRef.current,
          nextItem,
        );
        const mergedGroup = mergeQueuedFollowUpGroup(groupedItems, {
          leadItemId: nextItem.id,
        });
        if (!mergedGroup) {
          break;
        }

        removePendingFollowUps(mergedGroup.items.map((item) => item.id));
        insertPendingFollowUpsIntoTranscript(mergedGroup.items);
        await submitRef.current?.(toQueuedSendRequest(mergedGroup.request), {
          ...(mergedGroup.context ? { context: mergedGroup.context } : {}),
          ...(mergedGroup.config ? { config: mergedGroup.config } : {}),
          threadId: activeThreadIdRef.current ?? threadId ?? undefined,
        });
      }
    })().finally(() => {
      if (queueDrainPromiseRef.current === drainPromise) {
        queueDrainPromiseRef.current = null;
      }
    });

    queueDrainPromiseRef.current = drainPromise;
    return drainPromise;
  }, [
    client,
    insertPendingFollowUpsIntoTranscript,
    removePendingFollowUps,
    threadId,
  ]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    void drainQueuedFollowUps().catch((error) =>
      setError(error instanceof Error ? error : new Error(String(error))),
    );
  }, [drainQueuedFollowUps, isLoading]);
  return {
    sendSteerFollowUp,
    canSendPendingFollowUpNow,
    sendPendingFollowUpNow,
    promotePendingFollowUpToSteer,
  };
}
