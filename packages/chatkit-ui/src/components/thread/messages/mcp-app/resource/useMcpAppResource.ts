import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import {
  isMcpAppSessionError,
  type McpAppHistory,
  type McpAppResourceResponse,
} from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import type { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import type { StreamContextType } from '../../../../../providers/Stream';
import {
  buildMcpAppTheme,
  injectMcpAppLocale,
  injectMcpAppTheme,
  normalizeHostLocale,
} from '../presentation/host-context';
import { injectCsp } from '../sandbox/html';
import {
  getMcpAppResourceFailure,
  isMcpAppAccessDenied,
  type McpAppResourceFailure,
} from './history-status';
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

/**
 * History is authorized independently of the interactive session. Only the
 * history endpoint supplies fallback content; resumption requires a user action.
 */
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
  const [failure, setFailure] = React.useState<McpAppResourceFailure | null>(
    null,
  );
  const [history, setHistory] = React.useState<McpAppHistory | null>(null);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyUnavailable, setHistoryUnavailable] = React.useState(false);
  const [resuming, setResuming] = React.useState(false);
  const [resumeFailed, setResumeFailed] = React.useState(false);
  const lifecycleRef = React.useRef<AbortController | null>(null);
  const resumingRef = React.useRef(false);
  // Restoring the same App ID creates a new iframe session. Its epoch prevents
  // pending work from the previous session from affecting the replacement.
  const resourceEpochRef = React.useRef(0);
  const [resourceEpoch, setResourceEpoch] = React.useState(0);
  const getResourceEpoch = React.useCallback(
    () => resourceEpochRef.current,
    [],
  );
  const failureRef = React.useRef<McpAppResourceFailure | null>(null);
  const isResourceEpochCurrent = React.useCallback(
    (epoch: number) =>
      epoch === resourceEpochRef.current &&
      failureRef.current === null &&
      lifecycleRef.current?.signal.aborted === false,
    [],
  );

  const installResource = React.useCallback(
    (payload: McpAppResourceResponse, fromHistory = false) => {
      const normalizedResource = normalizeMcpAppResourceResponse(
        payload,
        // Resumption uses the authorized server result, never stale client data.
        fromHistory
          ? { ...data, toolInput: undefined, toolResult: undefined }
          : data,
      );
      resourceEpochRef.current += 1;
      setResourceEpoch(resourceEpochRef.current);
      teardownStartedRef.current = false;
      initializedRef.current = false;
      sentInitialResultRef.current = false;
      setResource(normalizedResource);
      const nextAppInstanceToken =
        normalizedResource.appInstanceToken ?? data.appInstanceToken;
      runtimeAppInstanceTokenRef.current = nextAppInstanceToken;
      setRuntimeAppInstanceToken(nextAppInstanceToken);
      setSrcDoc(
        injectMcpAppTheme(
          injectCsp(
            injectMcpAppLocale(
              normalizedResource.html,
              normalizeHostLocale(i18n.language),
            ),
            normalizedResource.csp ?? data.csp,
          ),
          buildMcpAppTheme(containerRef.current),
        ),
      );
      failureRef.current = null;
      setFailure(null);
      setError(null);
    },
    [data, i18n.language],
  );

  const presentFailure = React.useCallback(
    async (error: unknown, controller: AbortController) => {
      if (controller.signal.aborted) return;
      const nextFailure = getMcpAppResourceFailure(error);
      // Concurrent RPCs can fail together. Fetch the authorized snapshot once,
      // while always honoring a later permission denial.
      if (failureRef.current && nextFailure !== 'forbidden') return;
      failureRef.current = nextFailure;
      setFailure(nextFailure);
      setResource(null);
      setSrcDoc(null);
      initializedRef.current = false;
      sentInitialResultRef.current = false;
      pendingApprovalRef.current = null;
      approvalActionRef.current = null;
      setPendingApproval(null);
      setApprovalAction(null);
      setApprovalError(null);
      setIsLoading(false);
      if (nextFailure === 'forbidden') {
        // A permission denial must also discard any previously fetched history.
        setHistory(null);
        setHistoryLoading(false);
        return;
      }
      if (!messageId) return;
      setHistoryLoading(true);
      try {
        const snapshot = await client.mcp.apps.getHistory(
          data.appInstanceId,
          { messageId },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted && failureRef.current !== 'forbidden')
          setHistory(snapshot);
      } catch (historyError) {
        if (controller.signal.aborted) return;
        if (isMcpAppAccessDenied(historyError)) {
          failureRef.current = 'forbidden';
          setHistory(null);
          setFailure('forbidden');
        } else {
          setHistoryUnavailable(true);
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    },
    [client, data.appInstanceId, messageId],
  );

  const handleRuntimeError = React.useCallback(
    async (error: unknown, resourceEpoch: number) => {
      // A late failure from an old session cannot revoke a newly restored one.
      if (resourceEpoch !== resourceEpochRef.current) return;
      const controller = lifecycleRef.current;
      if (
        controller &&
        (isMcpAppSessionError(error) || isMcpAppAccessDenied(error))
      ) {
        await presentFailure(error, controller);
      }
    },
    [presentFailure],
  );

  // canResume controls the affordance only. The server rechecks current access
  // and issues a new lease without executing the original query again.
  const resume = React.useCallback(async () => {
    const controller = lifecycleRef.current;
    const resumeEpoch = resourceEpochRef.current;
    const isDenied = () => failureRef.current === 'forbidden';
    if (
      isDenied() ||
      !history?.canResume ||
      !messageId ||
      !controller ||
      controller.signal.aborted ||
      resumingRef.current
    )
      return;
    resumingRef.current = true;
    setResuming(true);
    setResumeFailed(false);
    try {
      const payload = await client.mcp.apps.resume(
        data.appInstanceId,
        { messageId },
        { signal: controller.signal },
      );
      if (
        controller.signal.aborted ||
        resumeEpoch !== resourceEpochRef.current ||
        isDenied()
      )
        return;
      installResource(payload, true);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (isMcpAppAccessDenied(error)) {
        // ACL may have changed since the snapshot was fetched.
        failureRef.current = 'forbidden';
        setHistory(null);
        setFailure('forbidden');
      } else {
        setResumeFailed(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        resumingRef.current = false;
        setResuming(false);
      }
    }
  }, [
    client,
    data.appInstanceId,
    history?.canResume,
    installResource,
    messageId,
  ]);
  const sendInitialToolNotifications = React.useCallback(() => {
    if (!initializedRef.current || sentInitialResultRef.current || !resource) {
      return;
    }

    // Deliver the saved result once per iframe initialization, including resume.
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
    lifecycleRef.current = controller;
    resourceEpochRef.current += 1;
    setResourceEpoch(resourceEpochRef.current);
    resumingRef.current = false;
    failureRef.current = null;
    setFailure(null);
    setHistory(null);
    setHistoryLoading(false);
    setHistoryUnavailable(false);
    setResuming(false);
    setResumeFailed(false);
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
        if (!controller.signal.aborted) installResource(payload);
      } catch (loadError) {
        await presentFailure(loadError, controller);
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
    installResource,
    presentFailure,
  ]);
  return {
    sendInitialToolNotifications,
    handleRuntimeError,
    getResourceEpoch,
    isResourceEpochCurrent,
    resourceEpoch,
    failure,
    history,
    historyLoading,
    historyUnavailable,
    resuming,
    resumeFailed,
    resume,
  };
}
