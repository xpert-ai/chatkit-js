import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import type { StreamContextType } from '../../../../../providers/Stream';
import { buildMcpAppReviveQuery } from '../resource/normalization';
import type { ResolvedMcpAppSandboxProxy } from '../types';
import type { useMcpAppState } from './useMcpAppState';

type McpAppTeardownOptions = Pick<
  ReturnType<typeof useMcpAppState>,
  | 'teardownGenerationRef'
  | 'activeAppInstanceIdRef'
  | 'appWindowRef'
  | 'runtimeAppInstanceTokenRef'
  | 'pendingApprovalRef'
  | 'teardownStartedRef'
> & {
  data: TMessageComponentMcpAppData;
  sandboxProxy: ResolvedMcpAppSandboxProxy | null;
  messageId: string | undefined;
  client: StreamContextType['client'];
};

export function useMcpAppTeardown({
  teardownGenerationRef,
  activeAppInstanceIdRef,
  data,
  appWindowRef,
  sandboxProxy,
  runtimeAppInstanceTokenRef,
  messageId,
  pendingApprovalRef,
  teardownStartedRef,
  client,
}: McpAppTeardownOptions) {
  const isSupersededStrictModeTeardown = React.useCallback(
    (generation: number, appInstanceId: string) =>
      teardownGenerationRef.current !== generation &&
      activeAppInstanceIdRef.current === appInstanceId,
    [],
  );

  React.useEffect(() => {
    const generation = ++teardownGenerationRef.current;
    activeAppInstanceIdRef.current = data.appInstanceId;
    return () => {
      const appWindow = appWindowRef.current;
      const appOrigin = sandboxProxy?.origin ?? '*';
      const query = buildMcpAppReviveQuery(data, {
        appInstanceToken: runtimeAppInstanceTokenRef.current,
        messageId,
      });
      const approval = pendingApprovalRef.current;
      queueMicrotask(() => {
        if (isSupersededStrictModeTeardown(generation, data.appInstanceId)) {
          return;
        }
        if (teardownStartedRef.current) {
          return;
        }
        teardownStartedRef.current = true;
        try {
          appWindow?.postMessage(
            {
              jsonrpc: '2.0',
              id: `xpert-teardown-${data.appInstanceId}`,
              method: 'ui/resource-teardown',
              params: { reason: 'host-unmount' },
            },
            appOrigin,
          );
        } catch {
          // Detached iframe windows can disappear before React effect cleanup.
        }
        void (async () => {
          if (approval) {
            await client.mcp.apps
              .reject(data.appInstanceId, approval.approvalId, query)
              .catch(() => undefined);
          }
          await client.mcp.apps
            .teardown(data.appInstanceId, query)
            .catch(() => undefined);
        })();
      });
    };
  }, [
    client,
    data,
    data.appInstanceId,
    isSupersededStrictModeTeardown,
    messageId,
    sandboxProxy?.origin,
  ]);
}
