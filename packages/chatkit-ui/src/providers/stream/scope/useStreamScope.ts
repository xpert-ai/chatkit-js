import type { Client } from '@xpert-ai/xpert-sdk';
import { useQueryState } from 'nuqs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { persistConversationConnectorBindingIds } from '../../../lib/conversation-connectors';
import type { StateType } from '../types';
import { normalizeThreadIdentifier } from './thread-identity';

type StreamScopeOptions = {
  initialThread: string | null | undefined;
  threadStateMode: 'url' | 'memory';
  resetThreadOnMount: boolean;
};

export function useStreamScope({
  initialThread,
  threadStateMode,
  resetThreadOnMount,
}: StreamScopeOptions) {
  const [queryThreadId, setQueryThreadId] = useQueryState('threadId');
  const [memoryThreadId, setMemoryThreadId] = useState<string | null>(
    initialThread ?? null,
  );

  const threadId =
    threadStateMode === 'memory' ? memoryThreadId : queryThreadId;

  const setThreadId = useCallback(
    (nextThreadId: string | null) => {
      if (threadStateMode === 'memory') {
        setMemoryThreadId(nextThreadId);
        return;
      }
      void setQueryThreadId(nextThreadId);
    },
    [setQueryThreadId, threadStateMode],
  );

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [connectorBindingIds, setConnectorBindingIdsState] = useState<string[]>(
    [],
  );

  const consumedInitialThreadRef = useRef<string | null>(null);
  const initialSelectedThreadRef = useRef(
    resetThreadOnMount || initialThread != null ? null : threadId,
  );

  const conversationIdRef = useRef<string | null>(null);
  const connectorBindingIdsRef = useRef<string[]>([]);
  const activeThreadIdRef = useRef<string | null>(threadId ?? null);
  const clientRef = useRef<Client<StateType> | null>(null);

  // Track the previous threadId so we only reset SSE state on actual thread changes.
  const lastThreadIdRef = useRef<string | null>(threadId ?? null);
  const hasObservedThreadSelectionRef = useRef(
    normalizeThreadIdentifier(threadId) !== null,
  );

  const suppressThreadChangeRef = useRef(false);

  useEffect(() => {
    activeThreadIdRef.current = threadId ?? null;
  }, [threadId]);

  const updateConversationId = useCallback(
    (nextConversationId: string | null) => {
      conversationIdRef.current = nextConversationId;
      setConversationId(nextConversationId);
    },
    [],
  );

  const updateConnectorBindingIdsState = useCallback(
    (nextBindingIds: readonly string[]) => {
      const normalized = Array.from(
        new Set(
          nextBindingIds.map((bindingId) => bindingId.trim()).filter(Boolean),
        ),
      );
      connectorBindingIdsRef.current = normalized;
      setConnectorBindingIdsState(normalized);
    },
    [],
  );

  const setConnectorBindingIds = useCallback(
    async (nextBindingIds: string[]) => {
      const previous = connectorBindingIdsRef.current;
      updateConnectorBindingIdsState(nextBindingIds);

      const activeConversationId = conversationIdRef.current?.trim();
      if (!activeConversationId) return;
      const activeClient = clientRef.current;
      if (!activeClient) return;

      try {
        const conversation =
          await activeClient.conversations.get(activeConversationId);
        await persistConversationConnectorBindingIds({
          client: activeClient,
          conversation,
          bindingIds: nextBindingIds,
        });
      } catch (persistError) {
        updateConnectorBindingIdsState(previous);
        throw persistError;
      }
    },
    [updateConnectorBindingIdsState],
  );
  return {
    conversationIdRef,
    activeThreadIdRef,
    clientRef,
    updateConversationId,
    consumedInitialThreadRef,
    threadId,
    hasObservedThreadSelectionRef,
    suppressThreadChangeRef,
    conversationId,
    lastThreadIdRef,
    setThreadId,
    updateConnectorBindingIdsState,
    connectorBindingIdsRef,
    initialSelectedThreadRef,
    connectorBindingIds,
    setConnectorBindingIds,
  };
}
