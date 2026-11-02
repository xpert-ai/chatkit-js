import type { useStreamContext } from '../../../providers/Stream';
import { HITLApprovalPanel } from '../../composer/hitl-approval-panel';
import { PendingFollowUps } from '../../composer/pending-follow-ups';
import { PendingRuntimeServices } from '../../composer/pending-runtime-services';
import { PendingTodos } from '../../composer/pending-todos';
import { RequestUserInputPanel } from '../../composer/request-user-input-panel';
import { ToolAfterPanel } from '../../composer/tool-after-panel';
import type { useChatHost } from '../host/useChatHost';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatCommands } from './useChatCommands';

type ChatPendingActionsProps = Pick<
  ReturnType<typeof useChatEnvironment>,
  'stream'
> &
  Pick<ReturnType<typeof useChatCommands>, 'handleEditPendingFollowUp'> &
  Pick<ReturnType<typeof useChatHost>, 'inlineApproval'> & {
    canRespond: boolean;
    hasPendingTodos: boolean;
    hasPendingFollowUps: boolean;
    pendingFollowUps: ReturnType<typeof useStreamContext>['pendingFollowUps'];
  };

export function ChatPendingActions({
  stream,
  canRespond,
  hasPendingTodos,
  hasPendingFollowUps,
  pendingFollowUps,
  handleEditPendingFollowUp,
  inlineApproval,
}: ChatPendingActionsProps) {
  return (
    <>
      <div className="contents" data-chat-auxiliary="">
        <PendingRuntimeServices
          state={stream.runtimeActivities.sandboxServices}
          onStopService={(serviceId) =>
            stream.stopRuntimeActivityItem('sandbox-services', serviceId)
          }
          attachToComposer={!hasPendingTodos && !hasPendingFollowUps}
          className={
            hasPendingTodos || hasPendingFollowUps ? 'mb-2' : undefined
          }
        />
        <PendingTodos
          snapshot={stream.todos}
          attachToComposer={!hasPendingFollowUps}
          className={hasPendingFollowUps ? 'mb-2' : undefined}
        />
        <PendingFollowUps
          items={pendingFollowUps}
          isLoading={stream.isLoading}
          onPromoteToSteer={(id) => stream.promotePendingFollowUpToSteer(id)}
          canSendNow={stream.canSendPendingFollowUpNow}
          onSendNow={(id) => stream.sendPendingFollowUpNow(id)}
          onEdit={handleEditPendingFollowUp}
          onRemove={stream.removePendingFollowUp}
          attachToComposer
        />
      </div>
      <fieldset
        disabled={!canRespond}
        className="contents"
        data-chat-auxiliary=""
      >
        <RequestUserInputPanel
          request={stream.pendingRequestUserInput}
          onSubmit={(answers, status) => {
            if (canRespond) stream.submitRequestUserInput(answers, status);
          }}
          onDismiss={() => {
            if (canRespond) stream.submitRequestUserInput([], 'cancelled');
          }}
          attachToComposer
        />
        <ToolAfterPanel disabled={!canRespond} />
        {!inlineApproval.enabled && (
          <HITLApprovalPanel
            request={stream.pendingHITLRequest}
            onSubmit={(decisions) => {
              if (canRespond) stream.submitHITLDecision(decisions);
            }}
            onDismiss={stream.stop}
            attachToComposer
          />
        )}
      </fieldset>
    </>
  );
}
