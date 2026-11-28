import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../resource-cards/context';
import * as React from 'react';
import { SideChatHeaderContext } from './SideChatHeaderActions';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { StreamProvider, useStreamContext } from '../../providers/Stream';
import type { WorkbenchRuntime } from '../WorkbenchRuntime';
import { Chat } from '../../components/chat';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
  useWorkbench,
} from '../context';
import { sideChatViewKey, type SideChatSession } from './types';

export function SideChatView({
  session,
  options,
  stream,
  onStatus,
}: {
  session: SideChatSession;
  options?: ChatKitOptions | null;
  stream: WorkbenchRuntime;
  onStatus?: (
    id: string,
    status: SideChatSession['status'],
    selectedThreadId?: string | null,
  ) => void;
}) {
  const parentWorkbench = useWorkbench();
  const outputWorkbench = React.useMemo(
    () => ({
      ...disabledWorkbenchContext,
      openArtifact: parentWorkbench.openArtifact,
      openHtmlArtifact: parentWorkbench.openHtmlArtifact,
      openFileReview: parentWorkbench.openFileReview,
      openSummaryResource: parentWorkbench.openSummaryResource,
    }),
    [
      parentWorkbench.openArtifact,
      parentWorkbench.openHtmlArtifact,
      parentWorkbench.openFileReview,
      parentWorkbench.openSummaryResource,
    ],
  );
  const [initialThread] = React.useState(
    session.selectedThreadId ?? session.threadId,
  );
  const sideChatOptions = React.useMemo<ChatKitOptions | null>(() => {
    if (!options) return null;
    return {
      ...options,
      initialThread,
      header: {
        ...options.header,
        enabled: true,
        identity: { enabled: false },
        character: { enabled: false },
      },
      history: { ...options.history, enabled: false },
      taskSummary: { ...options.taskSummary, enabled: true },
      workbench: {
        ...options.workbench,
        enabled: false,
        sideChat: { enabled: false },
        externalAssistants: { enabled: false },
      },
      pet: false,
    };
  }, [options, initialThread]);

  return (
    <SideChatHeaderContext.Provider value={sideChatViewKey(session.threadId)}>
      <ResourceCardContext.Provider value={unavailableResourceCardActions}>
        <WorkbenchContext.Provider value={outputWorkbench}>
          <StreamProvider
            apiKey={stream.apiKey ?? ''}
            getClientSecret={stream.refreshClientSecret}
            organizationId={stream.organizationId}
            apiUrl={stream.apiUrl}
            xpertId={stream.assistantId}
            projectId={stream.projectId}
            initialThread={initialThread}
            threadStateMode="memory"
            hostIntegration={false}
          >
            <SideChatStatus id={session.threadId} onStatus={onStatus} />
            <Chat
              className="h-full"
              clientSecret={stream.apiKey}
              options={sideChatOptions}
              surface="side"
              inheritedMessagesEndId={session.inheritedMessagesEndId}
              referenceRequest={session.referenceRequest}
            />
          </StreamProvider>
        </WorkbenchContext.Provider>
      </ResourceCardContext.Provider>
    </SideChatHeaderContext.Provider>
  );
}

function SideChatStatus({
  id,
  onStatus,
}: {
  id: string;
  onStatus?: (
    id: string,
    status: SideChatSession['status'],
    selectedThreadId?: string | null,
  ) => void;
}) {
  const stream = useStreamContext();
  const status =
    stream.pendingHITLRequest || stream.pendingRequestUserInput
      ? 'interrupted'
      : stream.isLoading
        ? 'busy'
        : stream.error
          ? 'error'
          : 'idle';
  React.useEffect(() => {
    if (stream.isReady) onStatus?.(id, status, stream.threadId);
  }, [id, status, onStatus, stream.isReady, stream.threadId]);
  return null;
}
