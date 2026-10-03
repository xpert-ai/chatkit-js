import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pendingFollowUpToUiMessage,
  type PendingFollowUp,
} from '../../../lib/follow-ups';
import { appendMessages } from '../messages/reducer';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { ChatKitAIMessage } from '../types';

type StreamFollowUpStateOptions = Pick<
  ReturnType<typeof useStreamMessages>,
  'setValues'
>;

export function useStreamFollowUpState({
  setValues,
}: StreamFollowUpStateOptions) {
  const [pendingFollowUps, setPendingFollowUps] = useState<PendingFollowUp[]>(
    [],
  );

  const [autoQueuedFollowUpIds, setAutoQueuedFollowUpIds] = useState<string[]>(
    [],
  );

  const pendingFollowUpsRef = useRef<PendingFollowUp[]>([]);
  const autoQueuedFollowUpIdsRef = useRef<Set<string>>(new Set());
  const steerPriorityFollowUpIdsRef = useRef<Set<string>>(new Set());
  const queueDrainPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    pendingFollowUpsRef.current = pendingFollowUps;
  }, [pendingFollowUps]);

  useEffect(() => {
    autoQueuedFollowUpIdsRef.current = new Set(autoQueuedFollowUpIds);
  }, [autoQueuedFollowUpIds]);

  const addAutoQueuedFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const nextQueuedIds = new Set(autoQueuedFollowUpIdsRef.current);
    for (const id of ids) {
      if (id) {
        nextQueuedIds.add(id);
      }
    }
    autoQueuedFollowUpIdsRef.current = nextQueuedIds;
    setAutoQueuedFollowUpIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (id) {
          next.add(id);
        }
      }
      return [...next];
    });
  }, []);

  const removeAutoQueuedFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    autoQueuedFollowUpIdsRef.current = new Set(
      [...autoQueuedFollowUpIdsRef.current].filter((id) => !idSet.has(id)),
    );
    setAutoQueuedFollowUpIds((prev) => prev.filter((id) => !idSet.has(id)));
  }, []);

  const addSteerPriorityFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const nextIds = new Set(steerPriorityFollowUpIdsRef.current);
    for (const id of ids) {
      if (id) {
        nextIds.add(id);
      }
    }
    steerPriorityFollowUpIdsRef.current = nextIds;
  }, []);

  const removeSteerPriorityFollowUpIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    steerPriorityFollowUpIdsRef.current = new Set(
      [...steerPriorityFollowUpIdsRef.current].filter((id) => !idSet.has(id)),
    );
  }, []);

  const removePendingFollowUps = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      pendingFollowUpsRef.current = pendingFollowUpsRef.current.filter(
        (item) => !idSet.has(item.id),
      );
      setPendingFollowUps((prev) => prev.filter((item) => !idSet.has(item.id)));
      removeAutoQueuedFollowUpIds(ids);
      removeSteerPriorityFollowUpIds(ids);
    },
    [removeAutoQueuedFollowUpIds, removeSteerPriorityFollowUpIds],
  );

  const removePendingFollowUp = useCallback(
    (id: string) => {
      if (!id) return;
      const targetItem = pendingFollowUpsRef.current.find(
        (item) => item.id === id,
      );
      if (!targetItem || targetItem.mode !== 'queue') {
        return;
      }
      removePendingFollowUps([id]);
    },
    [removePendingFollowUps],
  );

  const markPendingFollowUpsAsQueued = useCallback(
    (
      ids: string[],
      options?: { autoDrain?: boolean; queuedFromSteer?: boolean },
    ) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const markQueued = (item: PendingFollowUp): PendingFollowUp =>
        idSet.has(item.id)
          ? {
              ...item,
              mode: 'queue' as const,
              request: {
                ...item.request,
                followUpMode: 'queue',
              },
              queuedFromSteer: options?.queuedFromSteer ?? item.queuedFromSteer,
            }
          : item;
      pendingFollowUpsRef.current = pendingFollowUpsRef.current.map(markQueued);
      setPendingFollowUps((prev) => prev.map(markQueued));
      if (options?.autoDrain === true) {
        addAutoQueuedFollowUpIds(ids);
      } else if (options?.autoDrain === false) {
        removeAutoQueuedFollowUpIds(ids);
      }
    },
    [addAutoQueuedFollowUpIds, removeAutoQueuedFollowUpIds],
  );

  const insertPendingFollowUpsIntoTranscript = useCallback(
    (items: PendingFollowUp[], visibleAt?: string | null) => {
      const nextMessages = items
        .map((item) => pendingFollowUpToUiMessage(item, visibleAt))
        .filter(
          (
            item,
          ): item is NonNullable<
            ReturnType<typeof pendingFollowUpToUiMessage>
          > => Boolean(item),
        );
      appendMessages(setValues, nextMessages as ChatKitAIMessage[]);
    },
    [],
  );

  const flushSteerFollowUps = useCallback(
    (ids: string[], visibleAt?: string | null) => {
      if (ids.length === 0) {
        return;
      }

      const idSet = new Set(ids);
      const steerItems = pendingFollowUpsRef.current
        .filter(
          (item) =>
            item.mode === 'steer' &&
            (idSet.has(item.id) || idSet.has(item.clientMessageId)),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      if (steerItems.length === 0) {
        return;
      }

      insertPendingFollowUpsIntoTranscript(steerItems, visibleAt);
      removePendingFollowUps(steerItems.map((item) => item.id));
    },
    [insertPendingFollowUpsIntoTranscript, removePendingFollowUps],
  );
  return {
    steerPriorityFollowUpIdsRef,
    autoQueuedFollowUpIdsRef,
    pendingFollowUpsRef,
    setAutoQueuedFollowUpIds,
    setPendingFollowUps,
    addAutoQueuedFollowUpIds,
    removeAutoQueuedFollowUpIds,
    addSteerPriorityFollowUpIds,
    markPendingFollowUpsAsQueued,
    autoQueuedFollowUpIds,
    removePendingFollowUps,
    insertPendingFollowUpsIntoTranscript,
    queueDrainPromiseRef,
    flushSteerFollowUps,
    pendingFollowUps,
    removePendingFollowUp,
  };
}
