import * as React from 'react';
import type { Client } from '@xpert-ai/xpert-sdk';
import type { AgentRunInfo } from '../../lib/agent-runs';
import { isRunningRunStatus } from '../../lib/agent-run-render-tree';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

type Cancellation = { pending: boolean; error?: string };

export function useCancelExternalAssistant(
  client?: Client | null,
  threadId?: string | null,
  refresh?: () => Promise<void>,
) {
  const { t } = useChatkitTranslation();
  const locked = React.useRef(new Set<string>());
  const [requests, setRequests] = React.useState<Record<string, Cancellation>>(
    {},
  );
  const keyFor = (id: string) => `${threadId}:${id}`;

  const cancel = async (info: AgentRunInfo) => {
    if (!client || !threadId || !isRunningRunStatus(info.status)) return;
    const key = keyFor(info.id);
    if (locked.current.has(key)) return;
    locked.current.add(key);
    setRequests((previous) => ({ ...previous, [key]: { pending: true } }));
    try {
      // Keep the parent SSE stream open so the tool error and subsequent reply arrive.
      await client.runs.cancel(threadId, info.id, false);
      setRequests((previous) => ({ ...previous, [key]: { pending: false } }));
      await refresh?.();
    } catch (error) {
      locked.current.delete(key);
      setRequests((previous) => ({
        ...previous,
        [key]: {
          pending: false,
          error:
            error instanceof Error && error.message
              ? error.message
              : t('workbench.externalAssistants.cancelFailed'),
        },
      }));
    }
  };

  return {
    available: Boolean(client && threadId),
    cancel,
    request: (id: string) => requests[keyFor(id)],
  };
}
