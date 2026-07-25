import * as React from 'react';
import type { Client } from '@xpert-ai/xpert-sdk';
import type {
  ChatTaskSummaryOutput,
  ChatTaskSummarySource,
} from '@xpert-ai/chatkit-types';
import {
  mergeTaskSummary,
  type TaskSummaryAgent,
  type TaskSummaryLiveData,
  type TaskSummaryPending,
  type TaskSummarySection,
  type TaskSummarySnapshot,
} from '../lib/task-summary';

type TaskSummaryHistorySections = Partial<{
  outputs: ChatTaskSummaryOutput[];
  sources: ChatTaskSummarySource[];
  agents: TaskSummaryAgent[];
  pending: TaskSummaryPending[];
}>;

type LoadedSnapshot = {
  conversationId: string;
  snapshot: TaskSummarySnapshot;
};

export function useTaskSummary({
  enabled,
  conversationId,
  client,
  live,
}: {
  enabled: boolean;
  conversationId: string | null;
  client: Client;
  live: TaskSummaryLiveData;
}) {
  const [loaded, setLoaded] = React.useState<LoadedSnapshot | null>(null);
  const [historySections, setHistorySections] =
    React.useState<TaskSummaryHistorySections>({});
  const [historySectionsConversationId, setHistorySectionsConversationId] =
    React.useState<string | null>(null);
  const [loadingSections, setLoadingSections] = React.useState<
    Partial<Record<TaskSummarySection, boolean>>
  >({});
  const [error, setError] = React.useState<unknown>(null);
  const [retryVersion, setRetryVersion] = React.useState(0);
  const requestVersionRef = React.useRef(0);
  const conversationIdRef = React.useRef(conversationId);
  const sectionControllersRef = React.useRef(
    new Map<TaskSummarySection, AbortController>(),
  );
  conversationIdRef.current = conversationId;

  const abortSectionRequests = React.useCallback(() => {
    sectionControllersRef.current.forEach((controller) => controller.abort());
    sectionControllersRef.current.clear();
  }, []);

  React.useEffect(() => {
    abortSectionRequests();
    setHistorySections({});
    setHistorySectionsConversationId(conversationId);
    setLoadingSections({});
    setError(null);
    if (!enabled || !conversationId) {
      setLoaded(null);
      setHistorySectionsConversationId(null);
      return;
    }
    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;
    client.conversations
      .getTaskSummary(conversationId, { signal: controller.signal })
      .then((snapshot) => {
        if (requestVersionRef.current !== requestVersion) return;
        setLoaded({ conversationId, snapshot });
      })
      .catch((nextError) => {
        if (
          controller.signal.aborted ||
          requestVersionRef.current !== requestVersion
        )
          return;
        setLoaded(null);
        setError(nextError);
      });

    return () => {
      controller.abort();
      abortSectionRequests();
      requestVersionRef.current += 1;
    };
  }, [abortSectionRequests, client, conversationId, enabled, retryVersion]);

  const snapshot =
    loaded?.conversationId === conversationId ? loaded.snapshot : null;
  const activeHistorySections = React.useMemo(
    () =>
      historySectionsConversationId === conversationId ? historySections : {},
    [conversationId, historySections, historySectionsConversationId],
  );

  const loadSection = React.useCallback(
    async (section: TaskSummarySection) => {
      if (!enabled || !conversationId || loadingSections[section]) {
        return;
      }
      const current = activeHistorySections[section]?.length ?? 0;
      const controller = new AbortController();
      sectionControllersRef.current.get(section)?.abort();
      sectionControllersRef.current.set(section, controller);
      setLoadingSections((state) => ({ ...state, [section]: true }));
      try {
        const page = await client.conversations.listTaskSummaryItems(
          conversationId,
          section,
          { offset: current, limit: 50, signal: controller.signal },
        );
        if (conversationIdRef.current !== conversationId) return;
        setHistorySections(
          (state) =>
            ({
              ...state,
              [section]: [...(state[section] ?? []), ...page.items],
            }) as TaskSummaryHistorySections,
        );
      } catch (nextError) {
        if (!controller.signal.aborted) {
          setError(nextError);
        }
      } finally {
        if (sectionControllersRef.current.get(section) === controller) {
          sectionControllersRef.current.delete(section);
        }
        if (conversationIdRef.current === conversationId) {
          setLoadingSections((state) => ({ ...state, [section]: false }));
        }
      }
    },
    [
      activeHistorySections,
      client,
      conversationId,
      enabled,
      loadingSections,
    ],
  );

  return {
    summary: mergeTaskSummary(snapshot, live, activeHistorySections),
    historyError: error,
    retryHistory: () => setRetryVersion((version) => version + 1),
    loadSection,
    loadingSections,
    loadedSectionCounts: {
      outputs: activeHistorySections.outputs?.length ?? 0,
      sources: activeHistorySections.sources?.length ?? 0,
      agents: activeHistorySections.agents?.length ?? 0,
      pending: activeHistorySections.pending?.length ?? 0,
    },
  };
}
