import * as React from 'react';
import { jsonRpcError } from '../bridge/protocol';
import type { useMcpAppState } from '../session/useMcpAppState';
import type { useMcpAppApprovals } from './useMcpAppApprovals';

type McpAppApprovalExpiryOptions = Pick<
  ReturnType<typeof useMcpAppState>,
  'pendingApproval' | 'pendingApprovalRef'
> &
  Pick<ReturnType<typeof useMcpAppApprovals>, 'clearPendingApproval'> & {
    postToApp: (message: unknown) => void;
  };

export function useMcpAppApprovalExpiry({
  pendingApproval,
  clearPendingApproval,
  postToApp,
  pendingApprovalRef,
}: McpAppApprovalExpiryOptions) {
  React.useEffect(() => {
    if (!pendingApproval) return;
    const remaining = pendingApproval.expiresAt - Date.now();
    if (remaining <= 0) {
      clearPendingApproval();
      postToApp(
        jsonRpcError(
          pendingApproval.request.id,
          'The MCP App approval request expired',
          -32003,
        ),
      );
      return;
    }
    const timeout = window.setTimeout(() => {
      if (
        pendingApprovalRef.current?.approvalId !== pendingApproval.approvalId
      ) {
        return;
      }
      clearPendingApproval();
      postToApp(
        jsonRpcError(
          pendingApproval.request.id,
          'The MCP App approval request expired',
          -32003,
        ),
      );
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [clearPendingApproval, pendingApproval, postToApp]);
}
