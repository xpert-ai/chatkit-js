import * as React from 'react';
import type { Client, Run } from '@xpert-ai/xpert-sdk';
import {
  mergeAgentRunInfo,
  normalizeAgentRunInfo,
  type AgentRunInfo,
} from '../../lib/agent-runs';
import {
  getAgentRunDuration,
  isRunningRunStatus,
} from '../../lib/agent-run-render-tree';
import type { ExternalAssistantRun } from './external-assistant-runs';

/** A cancel receipt is not an end event. Reconcile with persisted executions when SSE is delayed or lost. */
export function useExternalAssistantRunSync({
  client,
  threadId,
  runs,
  active,
  onRunUpdate,
}: {
  client?: Client | null;
  threadId?: string | null;
  runs: ExternalAssistantRun[];
  active: boolean;
  onRunUpdate?: (threadId: string, run: AgentRunInfo) => void;
}) {
  const [confirmed, setConfirmed] = React.useState<
    Record<string, AgentRunInfo>
  >({});
  const scope = React.useMemo(() => ({ client, threadId }), [client, threadId]);
  const current = React.useRef({ scope, runs, onRunUpdate });
  current.current = { scope, runs, onRunUpdate };
  const mounted = React.useRef(true);
  const pending = React.useRef(new Map<string, Promise<void>>());
  const keyFor = (id: string) => `${threadId}:${id}`;
  const reconciled = runs.map((run) => {
    const snapshot = confirmed[keyFor(run.id)];
    return snapshot && isRunningRunStatus(run.info.status)
      ? { ...run, info: mergeAgentRunInfo(run.info, snapshot) }
      : run;
  });
  const runningIds = JSON.stringify(
    reconciled
      .filter((run) => isRunningRunStatus(run.info.status))
      .map((run) => run.id),
  );
  const idsRef = React.useRef<string[]>([]);
  idsRef.current = reconciled
    .filter((run) => isRunningRunStatus(run.info.status))
    .map((run) => run.id);

  const refresh = React.useCallback(async () => {
    if (
      !client ||
      !threadId ||
      !mounted.current ||
      current.current.scope !== scope
    )
      return;
    await Promise.allSettled(
      idsRef.current.map((id) => {
        const key = `${threadId}:${id}`;
        const existing = pending.current.get(key);
        if (existing) return existing;
        const request = client.runs
          .get(threadId, id)
          .then((snapshot) => {
            if (
              !mounted.current ||
              current.current.scope !== scope ||
              snapshot.run_id !== id ||
              snapshot.thread_id !== threadId ||
              isRunningRunStatus(snapshot.status)
            )
              return;
            const run = current.current.runs.find((item) => item.id === id);
            if (!run) return;
            const info = confirmedRunInfo(snapshot, run.info);
            setConfirmed((previous) => ({ ...previous, [key]: info }));
            current.current.onRunUpdate?.(threadId, info);
          })
          .finally(() => {
            if (pending.current.get(key) === request)
              pending.current.delete(key);
          });
        pending.current.set(key, request);
        return request;
      }),
    );
  }, [client, threadId, scope]);

  React.useEffect(() => {
    if (!active || !client || !threadId || runningIds === '[]') return;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [active, client, threadId, runningIds, refresh]);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return { runs: reconciled, refresh };
}

function confirmedRunInfo(snapshot: Run, previous: AgentRunInfo): AgentRunInfo {
  const summary = normalizeAgentRunInfo(snapshot.metadata?.agentRun);
  if (summary?.id === snapshot.run_id && summary.status === snapshot.status)
    return summary;
  // Older servers expose only the Run envelope. Freeze timing when its terminal status is observed.
  const observedAt = Date.now();
  return {
    id: snapshot.run_id,
    status: snapshot.status,
    updatedAt: snapshot.updated_at,
    endedAt: snapshot.updated_at,
    elapsedTime: getAgentRunDuration(previous, observedAt) ?? undefined,
  };
}
