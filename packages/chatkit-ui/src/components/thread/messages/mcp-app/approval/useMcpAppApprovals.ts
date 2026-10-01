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
  data,
  runtimeAppInstanceToken,
  messageId,
  client,
}: McpAppApprovalsOptions) {
  const clearPendingApproval = React.useCallback(() => {
    pendingApprovalRef.current = null;
    approvalActionRef.current = null;
    setPendingApproval(null);
    setApprovalAction(null);
    setApprovalError(null);
  }, []);

  const processHostRpcResponse = React.useCallback(
    (request: JsonRpcRequest, response: unknown) => {
      const nextApproval = readMcpAppPendingApproval(response, request);
      if (nextApproval) {
        if (pendingApprovalRef.current) {
          postToApp(
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
          postToApp(
            jsonRpcError(request.id, getErrorMessage(downloadError), -32005),
          );
          return;
        }
      }

      postToApp(response);
    },
    [postToApp],
  );

  const dispatchHostRpc = React.useCallback(
    async (request: JsonRpcRequest) => {
      try {
        processHostRpcResponse(request, await callHostRpc(request));
      } catch (rpcError) {
        postToApp(jsonRpcError(request.id, getErrorMessage(rpcError)));
      }
    },
    [callHostRpc, postToApp, processHostRpcResponse],
  );

  const resolvePendingApproval = React.useCallback(
    async (action: 'approve' | 'reject') => {
      const approval = pendingApprovalRef.current;
      if (!approval || approvalActionRef.current) return;
      if (approval.expiresAt <= Date.now()) {
        clearPendingApproval();
        postToApp(
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
          clearPendingApproval();
          postToApp(
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
        const retryRequest = withMcpAppApprovalId(
          approval.request,
          approval.approvalId,
        );
        const response = await callHostRpc(retryRequest);
        clearPendingApproval();
        processHostRpcResponse(retryRequest, response);
      } catch (approvalRequestError) {
        approvalActionRef.current = null;
        setApprovalAction(null);
        setApprovalError(getErrorMessage(approvalRequestError));
      }
    },
    [
      callHostRpc,
      clearPendingApproval,
      client,
      data,
      messageId,
      postToApp,
      processHostRpcResponse,
      runtimeAppInstanceToken,
    ],
  );
  return { clearPendingApproval, dispatchHostRpc, resolvePendingApproval };
}
