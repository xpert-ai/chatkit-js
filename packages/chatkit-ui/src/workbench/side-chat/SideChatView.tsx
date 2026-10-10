import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../resource-cards/context';
import * as React from 'react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { StreamProvider } from '../../providers/Stream';
import type { WorkbenchRuntime } from '../WorkbenchRuntime';
import { Chat } from '../../components/chat';
import { WorkbenchContext, disabledWorkbenchContext } from '../context';
import type { SideChatSession } from './types';

export function SideChatView({
  session,
  options,
  stream,
}: {
  session: SideChatSession;
  options?: ChatKitOptions | null;
  stream: WorkbenchRuntime;
}) {
  const sideChatOptions = React.useMemo<ChatKitOptions | null>(() => {
    if (!options) return null;
    return {
      ...options,
      initialThread: session.threadId,
      header: { ...options.header, enabled: false },
      history: { ...options.history, enabled: false },
      taskSummary: { ...options.taskSummary, enabled: false },
      workbench: {
        ...options.workbench,
        enabled: false,
        sideChat: { enabled: false },
        externalAssistants: { enabled: false },
      },
      pet: false,
    };
  }, [options, session.threadId]);

  return (
    <ResourceCardContext.Provider value={unavailableResourceCardActions}>
      <WorkbenchContext.Provider value={disabledWorkbenchContext}>
        <StreamProvider
          apiKey={stream.apiKey ?? ''}
          getClientSecret={stream.refreshClientSecret}
          organizationId={stream.organizationId}
          apiUrl={stream.apiUrl}
          xpertId={stream.assistantId}
          projectId={stream.projectId}
          initialThread={session.threadId}
          threadStateMode="memory"
          hostIntegration={false}
        >
          <Chat
            className="h-full"
            clientSecret={stream.apiKey}
            options={sideChatOptions}
            surface="side"
            referenceRequest={session.referenceRequest}
          />
        </StreamProvider>
      </WorkbenchContext.Provider>
    </ResourceCardContext.Provider>
  );
}
