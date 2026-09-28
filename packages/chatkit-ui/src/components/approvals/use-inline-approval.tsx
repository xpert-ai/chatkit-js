import * as React from 'react';
import type { ChatKitOptions, HITLDecision } from '@xpert-ai/chatkit-types';
import type { PendingHITLRequest } from '../../lib/hitl';
import type { ParentMessenger } from '../../providers/ParentMessenger';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { ActionApprovalCard } from './action-approval-card';

export function useInlineApproval({
  request,
  options,
  messenger,
  submit,
  threadId,
}: {
  request: PendingHITLRequest | null;
  options: ChatKitOptions['approvals'];
  messenger: ParentMessenger | null;
  submit: (decisions: HITLDecision[]) => void;
  threadId: string | null | undefined;
}) {
  const { t } = useChatkitTranslation();
  const active = React.useRef({ id: request?.id, threadId });
  active.current = { id: request?.id, threadId };
  React.useEffect(() => {
    active.current = { id: request?.id, threadId };
    return () => {
      active.current = { id: undefined, threadId: undefined };
    };
  }, [request?.id, threadId]);
  const enabled = options?.placement === 'inline' || !!request?.request.host;
  const decide = async (decisions: HITLDecision[]) => {
    if (!request) return;
    if (request.request.host) {
      const input = { request: request.request, decisions };
      const response =
        typeof options?.onDecision === 'function'
          ? await options.onDecision(input)
          : await messenger?.sendCommand('onApprovalDecision', input);
      if (
        !response ||
        typeof response !== 'object' ||
        !('accepted' in response) ||
        response.accepted !== true
      )
        throw new Error(t('approvals.hostRejected'));
    }
    if (
      active.current.id !== request.id ||
      active.current.threadId !== threadId
    )
      return;
    submit(decisions);
  };
  const onAction =
    request?.request.host && options?.onAction
      ? async () => {
          const input = {
            request: request.request,
            action: 'settings' as const,
          };
          if (typeof options.onAction === 'function')
            await options.onAction(input);
          else await messenger?.sendCommand('onApprovalAction', input);
        }
      : undefined;
  return {
    enabled,
    card:
      enabled && request ? (
        <ActionApprovalCard
          key={request.id}
          request={request}
          onSubmit={decide}
          onAction={onAction}
        />
      ) : null,
  };
}
