import { useEffect, useMemo, useState } from 'react';
import type { Client, ThreadCapabilities } from '@xpert-ai/xpert-sdk';
import { createSharedCapabilityRead } from '../lib/shared-capability-read';

const readCapabilities = createSharedCapabilityRead<ThreadCapabilities>();

/** Availability is server-owned; pending or failed reads keep retry disabled. */
export function useThreadCapabilities({
  client,
  threadId,
  enabled,
  isLoading,
  status,
  error,
}: {
  client: { threads: Pick<Client['threads'], 'getCapabilities'> };
  threadId: string | null;
  enabled: boolean;
  isLoading: boolean;
  status?: string;
  error?: unknown;
}) {
  const request = useMemo(
    () => ({ client, threadId, enabled, isLoading, status, error }),
    [client, threadId, enabled, isLoading, status, error],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    capabilities: ThreadCapabilities;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (
      !threadId ||
      !enabled ||
      isLoading ||
      typeof client.threads.getCapabilities !== 'function'
    )
      return;
    const pending = readCapabilities(client, [threadId, status, error], () =>
      client.threads.getCapabilities(threadId),
    );
    void pending.promise.then(
      (capabilities) => {
        if (active) setResult({ request, capabilities });
      },
      () => {
        // The next thread/run change refreshes availability. Do not infer a recovery diagnosis.
      },
    );
    return () => {
      active = false;
      pending.release();
    };
  }, [request, client, threadId, enabled, isLoading, status, error]);

  return result?.request === request && result.capabilities.canRetry === true;
}
