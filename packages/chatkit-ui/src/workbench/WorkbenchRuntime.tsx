import { createContext, useContext } from 'react';
import type { StreamContextType } from '../providers/stream/types';
import type { parseChatMessagePayload } from './message-command-payload';

/** Workbench consumes conversation capabilities, independently of its transport. */
export type WorkbenchRuntime = Pick<
  StreamContextType,
  | 'client'
  | 'apiUrl'
  | 'assistantId'
  | 'projectId'
  | 'organizationId'
  | 'threadId'
  | 'conversationId'
  | 'messages'
  | 'runtimeScopeReady'
  | 'historyLoad'
  | 'historyMessagePagination'
  | 'loadMoreConversationMessages'
  | 'reconcileAgentRun'
  | 'isLoading'
> & {
  apiKey?: string;
  authenticated?: boolean;
  submit?: StreamContextType['submit'];
  reset?: StreamContextType['reset'];
  refreshClientSecret?: StreamContextType['refreshClientSecret'];
  group?: {
    id: string;
    sendMessage: (
      message: ReturnType<typeof parseChatMessagePayload>,
    ) => Promise<void | false>;
  };
};

export const WorkbenchRuntimeContext = createContext<WorkbenchRuntime | null>(
  null,
);
export const useWorkbenchRuntime = () => useContext(WorkbenchRuntimeContext);
