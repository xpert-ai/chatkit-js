import { useEffect, useState } from 'react';
import type { ChatGroupRuntimeView, Client } from '@xpert-ai/xpert-sdk';

export type GroupExecutionTarget = { messageId: string; participantId: string };

/** Only loads the authorized record; rendering, tabs and layout belong to WorkbenchShell. */
export function useGroupExecutionRecord(client: Client, groupId?: string) {
  const [target, select] = useState<GroupExecutionTarget | null>(null);
  const [record, setRecord] = useState<ChatGroupRuntimeView>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    select(null);
  }, [groupId]);
  useEffect(() => {
    setRecord(undefined);
    setError(undefined);
    if (!target || !groupId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const value = await client.groups.runtime(
          groupId,
          target.messageId,
          target.participantId,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setRecord(value);
        setError(undefined);
        if (['running', 'pending'].includes(value.status))
          timer = setTimeout(refresh, 1500);
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [client, groupId, target]);
  return { target, record, error, select };
}
