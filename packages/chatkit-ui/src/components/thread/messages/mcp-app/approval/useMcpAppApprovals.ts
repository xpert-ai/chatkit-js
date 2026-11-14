import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import type { StreamContextType } from '../../../../../providers/Stream';
import { getErrorMessage, jsonRpcError } from '../bridge/protocol';
import {
  isMcpAppRpcSuccess,
  readMcpAppDisplayMode,
  readMcpAppPendingApproval,
  triggerMcpAppDownloads,
  withMcpAppApprovalId,
  type McpAppJsonRpcRequest as JsonRpcRequest,
} from '../host';
import { buildMcpAppReviveQuery } from '../resource/normalization';
import type { useMcpAppState } from '../session/useMcpAppState';

type McpAppApprovalsOptions = Pick<
  ReturnType<typeof useMcpAppState>,
  | 'pendingApprovalRef'
  | 'approvalActionRef'
  | 'setPendingApproval'
  | 'setApprovalAction'
  | 'setApprovalError'
  | 'setDisplayMode'
  | 'runtimeAppInstanceToken'
> & {
  postToApp: (message: unknown) => void;
  callHostRpc: (request: JsonRpcRequest) => Promise<unknown>;
  getResourceEpoch: () => number;
  isResourceEpochCurrent: (epoch: number) => boolean;
  data: TMessageComponentMcpAppData;
  messageId: string | undefined;
  client: StreamContextType['client'];
};

export function useMcpAppApprovals({
  pendingApprovalRef,
  approvalActionRef,
  setPendingApproval,
  setApprovalAction,
  setApprovalError,
  postToApp,
  setDisplayMode,
  callHostRpc,
  getResourceEpoch,
  isResourceEpochCurrent,
  data,
  runtimeAppInstanceToken,
  messageId,
  client,
}: McpAppApprovalsOptions) {
  const hostRequests = React.useRef(
    new Map<string, (response: unknown) => void>(),
  );
  const replyToRequest = React.useCallback(
    (response: unknown) => {
      if (
        response &&
        typeof response === 'object' &&
        'id' in response &&
        typeof response.id === 'string'
      ) {
        const resolve = hostRequests.current.get(response.id);
        if (resolve) {
          resolve(response);
          return;
        }
      }
      postToApp(response);
    },
    [postToApp],
  );
  React.useEffect(
    () => () => {
      for (const [id, resolve] of hostRequests.current)
        resolve(jsonRpcError(id, 'MCP App view closed'));
      hostRequests.current.clear();
    },
    [],
  );

  const clearPendingApproval = React.useCallback(() => {
    pendingApprovalRef.current = null;
    approvalActionRef.current = null;
    setPendingApproval(null);
    setApprovalAction(null);
    setApprovalError(null);
  }, []);

  const processHostRpcResponse = React.useCallback(
    (request: JsonRpcRequest, response: unknown) => {
      if (
        typeof request.id === 'string' &&
        request.id.startsWith('xpert-host-approval-') &&
        !hostRequests.current.has(request.id)
      )
        return;
      const nextApproval = readMcpAppPendingApproval(response, request);
      if (nextApproval) {
        if (pendingApprovalRef.current) {
          replyToRequest(
            jsonRpcError(
              request.id,
              'Another MCP App approval request is already pending',
              -32004,
            ),
          );
          return;
        }
        pendingApprovalRef.current = nextApproval;
        setPendingApproval(nextApproval);
        setApprovalError(null);
        return;
      }

      const nextDisplayMode = readMcpAppDisplayMode(response);
      if (request.method === 'ui/request-display-mode' && nextDisplayMode) {
        setDisplayMode(nextDisplayMode);
      }

      if (
        request.method === 'ui/download-file' &&
        isMcpAppRpcSuccess(response)
      ) {
        try {
          triggerMcpAppDownloads(request.params);
        } catch (downloadError) {
          replyToRequest(
            jsonRpcError(request.id, getErrorMessage(downloadError), -32005),
          );
          return;
        }
      }

      replyToRequest(response);
    },
    [replyToRequest],
  );

  const dispatchHostRpc = React.useCallback(
    async (request: JsonRpcRequest) => {
      const epoch = getResourceEpoch();
      try {
        const response = await callHostRpc(request);
        if (!isResourceEpochCurrent(epoch)) return;
        processHostRpcResponse(request, response);
      } catch (rpcError) {
        if (!isResourceEpochCurrent(epoch)) return;
        replyToRequest(jsonRpcError(request.id, getErrorMessage(rpcError)));
      }
    },
    [
      callHostRpc,
      getResourceEpoch,
      isResourceEpochCurrent,
      replyToRequest,
      processHostRpcResponse,
    ],
  );

  const resolvePendingApproval = React.useCallback(
    async (action: 'approve' | 'reject') => {
      const approval = pendingApprovalRef.current;
      const epoch = getResourceEpoch();
      if (!isResourceEpochCurrent(epoch)) return;
      if (!approval || approvalActionRef.current) return;
      if (approval.expiresAt <= Date.now()) {
        clearPendingApproval();
        replyToRequest(
          jsonRpcError(
            approval.request.id,
            'The MCP App approval request expired',
            -32003,
          ),
        );
        return;
      }

      approvalActionRef.current = action;
      setApprovalAction(action);
      setApprovalError(null);
      const query = buildMcpAppReviveQuery(data, {
        appInstanceToken: runtimeAppInstanceToken,
        messageId,
      });
      try {
        if (action === 'reject') {
          await client.mcp.apps.reject(
            data.appInstanceId,
            approval.approvalId,
            query,
          );
          if (!isResourceEpochCurrent(epoch)) return;
          clearPendingApproval();
          replyToRequest(
            jsonRpcError(
              approval.request.id,
              'The user rejected the MCP App action',
              -32002,
              { approvalId: approval.approvalId, rejected: true },
            ),
          );
          return;
        }

        await client.mcp.apps.approve(
          data.appInstanceId,
          approval.approvalId,
          query,
        );
        // Approval belongs to the session that requested it. Never retry its
        // tool call against an iframe restored while approval was in flight.
        if (!isResourceEpochCurrent(epoch)) return;
        const retryRequest = withMcpAppApprovalId(
          approval.request,
          approval.approvalId,
        );
        const response = await callHostRpc(retryRequest);
        if (!isResourceEpochCurrent(epoch)) return;
        clearPendingApproval();
        processHostRpcResponse(retryRequest, response);
      } catch (approvalRequestError) {
        if (!isResourceEpochCurrent(epoch)) return;
        // TODO: Route direct approval failures through the lifecycle handler.
        approvalActionRef.current = null;
        setApprovalAction(null);
        setApprovalError(getErrorMessage(approvalRequestError));
      }
    },
    [
      callHostRpc,
      getResourceEpoch,
      isResourceEpochCurrent,
      clearPendingApproval,
      client,
      data,
      messageId,
      replyToRequest,
      processHostRpcResponse,
      runtimeAppInstanceToken,
    ],
  );
  const authorizeHostAction = React.useCallback(
    (request: JsonRpcRequest, signal: AbortSignal) => {
      if (signal.aborted)
        return Promise.reject(new Error('MCP App view closed'));
      if (pendingApprovalRef.current || hostRequests.current.size)
        return Promise.reject(
          new Error('Another MCP App approval request is already pending'),
        );
      const id = `xpert-host-approval-${crypto.randomUUID()}`;
      return new Promise<void>((resolve, reject) => {
        const finish = (response: unknown) => {
          clearTimeout(timeout);
          signal.removeEventListener('abort', cancel);
          hostRequests.current.delete(id);
          if (isMcpAppRpcSuccess(response)) resolve();
          else
            reject(
              new Error(
                'MCP App action was rejected, expired, or is no longer authorized',
              ),
            );
        };
        const cancel = () => {
          if (pendingApprovalRef.current?.request.id === id)
            clearPendingApproval();
          finish(jsonRpcError(id, 'MCP App view closed'));
        };
        const timeout = setTimeout(cancel, 5 * 60_000);
        hostRequests.current.set(id, finish);
        signal.addEventListener('abort', cancel, { once: true });
        void dispatchHostRpc({ ...request, id });
      });
    },
    [clearPendingApproval, dispatchHostRpc],
  );
  return {
    clearPendingApproval,
    dispatchHostRpc,
    resolvePendingApproval,
    authorizeHostAction,
    replyToRequest,
  };
}
