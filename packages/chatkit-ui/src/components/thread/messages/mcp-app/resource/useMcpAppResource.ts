import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import type { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import type { StreamContextType } from '../../../../../providers/Stream';
import { getErrorMessage } from '../bridge/protocol';
import {
  buildMcpAppTheme,
  injectMcpAppLocale,
  injectMcpAppTheme,
  normalizeHostLocale,
} from '../presentation/host-context';
import { injectCsp } from '../sandbox/html';
import type { useMcpAppState } from '../session/useMcpAppState';
import {
  buildMcpAppReviveQuery,
  normalizeMcpAppResourceResponse,
} from './normalization';

type McpAppResourceOptions = Pick<
  ReturnType<typeof useMcpAppState>,
  | 'initializedRef'
  | 'sentInitialResultRef'
  | 'resource'
  | 'pendingApprovalRef'
  | 'approvalActionRef'
  | 'setRuntimeAppInstanceToken'
  | 'runtimeAppInstanceTokenRef'
  | 'teardownStartedRef'
  | 'setIsTornDown'
  | 'setDisplayMode'
  | 'setPendingApproval'
  | 'setApprovalAction'
  | 'setApprovalError'
  | 'setIsLoading'
  | 'setError'
  | 'setResource'
  | 'setSrcDoc'
  | 'containerRef'
> & {
  postToApp: (message: unknown) => void;
  data: TMessageComponentMcpAppData;
  client: StreamContextType['client'];
  messageId: string | undefined;
  i18n: ReturnType<typeof useChatkitTranslation>['i18n'];
};

export function useMcpAppResource({
  initializedRef,
  sentInitialResultRef,
  resource,
  postToApp,
  data,
  pendingApprovalRef,
  approvalActionRef,
  setRuntimeAppInstanceToken,
  runtimeAppInstanceTokenRef,
  teardownStartedRef,
  setIsTornDown,
  setDisplayMode,
  setPendingApproval,
  setApprovalAction,
  setApprovalError,
  setIsLoading,
  setError,
  setResource,
  setSrcDoc,
  client,
  messageId,
  i18n,
  containerRef,
}: McpAppResourceOptions) {
  const sendInitialToolNotifications = React.useCallback(() => {
    if (!initializedRef.current || sentInitialResultRef.current || !resource) {
      return;
    }

    sentInitialResultRef.current = true;
    postToApp({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-input',
      params: {
        arguments: resource.toolInput,
      },
    });
    if (!resource.hasToolResult) {
      return;
    }
    postToApp({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: {
        ...resource.toolResult,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        // Legacy compatibility for apps written before the 2026-01-26 notification shape.
        result: resource.rawToolResult,
      },
    });
  }, [data.toolCallId, data.toolName, postToApp, resource]);

  React.useEffect(() => {
    const controller = new AbortController();
    initializedRef.current = false;
    sentInitialResultRef.current = false;
    pendingApprovalRef.current = null;
    approvalActionRef.current = null;
    setRuntimeAppInstanceToken(data.appInstanceToken);
    runtimeAppInstanceTokenRef.current = data.appInstanceToken;
    teardownStartedRef.current = false;
    setIsTornDown(false);
    setDisplayMode('inline');
    setPendingApproval(null);
    setApprovalAction(null);
    setApprovalError(null);
    setIsLoading(true);
    setError(null);
    setResource(null);
    setSrcDoc(null);

    void (async () => {
      try {
        const payload = await client.mcp.apps.getResource(
          data.appInstanceId,
          buildMcpAppReviveQuery(data, { messageId }),
          { signal: controller.signal },
        );
        const normalizedResource = normalizeMcpAppResourceResponse(
          payload,
          data,
        );

        setResource(normalizedResource);
        const nextAppInstanceToken =
          normalizedResource.appInstanceToken ?? data.appInstanceToken;
        runtimeAppInstanceTokenRef.current = nextAppInstanceToken;
        setRuntimeAppInstanceToken(nextAppInstanceToken);
        const hostLocale = normalizeHostLocale(i18n.language);
        setSrcDoc(
          injectMcpAppTheme(
            injectCsp(
              injectMcpAppLocale(normalizedResource.html, hostLocale),
              normalizedResource.csp ?? data.csp,
            ),
            buildMcpAppTheme(containerRef.current),
          ),
        );
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [
    client,
    data,
    data.appInstanceId,
    data.appInstanceToken,
    data.csp,
    i18n.language,
    messageId,
  ]);
  return { sendInitialToolNotifications };
}
