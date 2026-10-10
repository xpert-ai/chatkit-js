import { useContext, useEffect, useRef, useState } from 'react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { Client, ChatGroupSnapshot } from '@xpert-ai/xpert-sdk';
import {
  isClientToolRequest,
  isHITLRequest,
  type ClientToolMessageInput,
  type HITLDecision,
} from '@xpert-ai/chatkit-types';
import { ParentMessengerContext } from '../../providers/ParentMessenger';
import { useStreamUserInput } from '../../providers/stream/interrupts/useStreamUserInput';
import {
  normalizeRequestUserInputToolCall,
  normalizeToolMessagesResponse,
} from '../../providers/stream/interrupts/client-tools';
import type { PendingHITLRequest } from '../../lib/hitl';
import { HITLApprovalPanel } from '../composer/hitl-approval-panel';
import { RequestUserInputPanel } from '../composer/request-user-input-panel';
import { Button } from '../ui/button';

/** Observation never executes tools. One assigned human explicitly claims before any host callback. */
export function GroupInteractions({
  client,
  group,
  onError,
}: {
  client: Client;
  group: ChatGroupSnapshot;
  onError: (error: unknown) => void;
}) {
  const { t } = useChatkitTranslation();
  const messenger = useContext(ParentMessengerContext);
  const userInput = useStreamUserInput();
  const [approval, setApproval] = useState<PendingHITLRequest | null>(null);
  const decisionResolver = useRef<((value: HITLDecision[]) => void) | null>(
    null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const alive = useRef(true);
  const receipts = useRef(
    new Map<
      string,
      {
        claimId: string;
        decisions?: HITLDecision[];
        toolMessages?: ClientToolMessageInput[];
      }
    >(),
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      userInput.clearPendingRequestUserInput();
      decisionResolver.current?.([]);
      decisionResolver.current = null;
    };
  }, []);
  const viewer = group.members.find(
    (member) => member.id === group.viewerParticipantId,
  );
  async function handle(id: string) {
    if (activeId) return;
    setActiveId(id);
    try {
      const cached = receipts.current.get(id);
      if (cached) {
        await client.groups.respondInteraction(group.id, id, cached);
        return;
      }
      const claimId = crypto.randomUUID();
      const claim = await client.groups.claimInteraction(group.id, id, claimId);
      const toolMessages: ClientToolMessageInput[] = [];
      const decisions: HITLDecision[] = [];
      for (const item of claim.requests) {
        if (!alive.current) return;
        if (item.kind === 'client_tool' && isClientToolRequest(item.request)) {
          for (const call of item.request.clientToolCalls) {
            if (!alive.current) return;
            const input = normalizeRequestUserInputToolCall(call);
            if (input)
              toolMessages.push(
                await userInput.waitForRequestUserInput(call, input),
              );
            else {
              if (!messenger?.isParentAvailable)
                throw new Error(t('group.hostRequired'));
              const response = normalizeToolMessagesResponse(
                await messenger.sendCommand('onClientToolCall', {
                  name: call.name,
                  params: call.args,
                  id: call.id,
                }),
              );
              if (!response) throw new Error(t('group.toolFailed'));
              toolMessages.push({
                ...response,
                tool_call_id: call.id,
                name: call.name,
              });
            }
          }
        } else if (item.kind === 'approval' && isHITLRequest(item.request)) {
          setApproval({ id, request: item.request, createdAt: Date.now() });
          decisions.push(
            ...(await new Promise<HITLDecision[]>((resolve) => {
              decisionResolver.current = resolve;
            })),
          );
        } else throw new Error(t('group.invalidInteraction'));
      }
      if (!alive.current) return;
      const response = {
        claimId,
        ...(decisions.length ? { decisions } : {}),
        ...(toolMessages.length ? { toolMessages } : {}),
      };
      // Retrying delivery after a network failure must not repeat completed browser tools.
      receipts.current.set(id, response);
      await client.groups.respondInteraction(group.id, id, response);
    } catch (error) {
      if (alive.current) onError(error);
    } finally {
      if (alive.current) {
        setActiveId(null);
        setApproval(null);
      }
    }
  }
  return (
    <div className="space-y-2 px-4">
      {(group.interactions ?? []).map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between rounded-lg border p-3 text-sm"
        >
          <span>
            {t('group.waitingFor', {
              name:
                group.members.find(
                  (member) => member.subjectId === item.assignedUserId,
                )?.name ?? '',
            })}
          </span>
          {viewer?.subjectId === item.assignedUserId && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void client.groups
                    .control(group.id, item.participantId, {
                      action: 'cancel',
                      runId: item.runId,
                    })
                    .catch(onError)
                }
              >
                {t('group.stop')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!activeId}
                onClick={() => void handle(item.id)}
              >
                {receipts.current.has(item.id)
                  ? t('group.retryResult')
                  : t('group.handle')}
              </Button>
            </div>
          )}
        </div>
      ))}
      <RequestUserInputPanel
        request={userInput.pendingRequestUserInput}
        onSubmit={userInput.submitRequestUserInput}
      />
      <HITLApprovalPanel
        request={approval}
        onSubmit={(decisions) => {
          const resolve = decisionResolver.current;
          decisionResolver.current = null;
          setApproval(null);
          resolve?.(decisions);
        }}
      />
    </div>
  );
}
