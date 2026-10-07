import type { Message } from '@langchain/core/messages';
import type { ToolCall } from '@langchain/core/messages/tool';
import type {
  ChatKitReference,
  ChatKitReferenceCompositionMode,
  FollowUpBehavior,
  HITLDecision,
  RequestUserInputAnswer,
  RequestUserInputToolArgs,
  TChatRequest,
  TChatTaskSummaryContribution,
  TXpertChatResumeRequest,
  ThreadGoal,
} from '@xpert-ai/chatkit-types';
import type { ThreadDisplayPause } from '@xpert-ai/xpert-sdk';
import type {
  Client,
  ChatMessage,
  ChatMessageBranching,
  ChatMessageInputCheckpoint,
  Checkpoint,
  Config,
  StreamMode,
} from '@xpert-ai/xpert-sdk';
import type { AgentRunInfo } from '../../lib/agent-runs';
import type { ResolvedClientSecret } from '../../lib/client-secret';
import type { FollowUpStatus, PendingFollowUp } from '../../lib/follow-ups';
import type { PendingHITLRequest } from '../../lib/hitl';
import type { MessageMetadataContainer } from '../../lib/message-metadata';
import type {
  RuntimeActivitiesState,
  RuntimeActivityProviderId,
} from '../../lib/runtime-activity';
import type { RuntimeCapabilitiesSelection } from '../../lib/runtime-capabilities';
import type { ThreadContextUsageByAgentKey } from '../../lib/thread-context-usage';
import type { TodoListSnapshot } from '../../lib/todos';
import type { ThreadHistoryState } from '../useThreadHistory';

export type ChatKitAIMessage = Message & {
  historical?: boolean;
  branching?: ChatMessageBranching;
  rootExecutionIds?: string[];
  /** `null`: the server has no saved input checkpoint, so the message cannot be edited into a branch. */
  inputCheckpoint?: ChatMessageInputCheckpoint | null;
  status?: string;
  executionId?: string;
  createdAt?: string;
  updatedAt?: string;
  attachments?: Record<string, unknown>[];
  fileAssets?: Record<string, unknown>[];
  references?: ChatKitReference[];
  submittedInput?: string;
  model?: string;
  referenceComposition?: ChatKitReferenceCompositionMode;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  followUpMode?: FollowUpBehavior;
  followUpStatus?: FollowUpStatus;
  targetExecutionId?: string | null;
  visibleAt?: string | null;
  clientToolCalls?: ToolCall[];
  agentRuns?: AgentRunInfo[];
  taskSummary?: TChatTaskSummaryContribution;
};

export type ChatKitMessageContentPart = NonNullable<
  Exclude<ChatKitAIMessage['content'], string>
>[number];

export type StateType = { messages: ChatKitAIMessage[] };

export type StreamRunInput = TChatRequest | TXpertChatResumeRequest;

export type ProjectSelection =
  import('@xpert-ai/chatkit-types').ProjectSelection;

export type HistoryMessagePaginationState = {
  conversationId: string | null;
  threadId: string | null;
  loadedCount: number;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
};

export type PendingRequestUserInput = {
  id: string;
  toolCallId?: string;
  params: RequestUserInputToolArgs;
  createdAt: number;
};

export type StreamSubmitOptions = {
  optimisticValues?:
    | Partial<StateType>
    | ((prev: StateType) => Partial<StateType>);
  preserveOptimisticMessages?: boolean;
  context?: Record<string, unknown>;
  config?: Config & Record<string, unknown>;
  checkpoint?: Omit<Checkpoint, 'thread_id'> | null;
  streamMode?: StreamMode | StreamMode[];
  streamSubgraphs?: boolean;
  streamResumable?: boolean;
  threadId?: string;
  newThread?: boolean;
  joinExistingThread?: boolean;
  followUpMode?: FollowUpBehavior;
  /** Called only after the server accepts the run and returns its identity. */
  onRunAccepted?: () => void;
  onThreadResolved?: (
    threadId: string,
    conversationId?: string | null,
  ) => void | Promise<void>;
};

export type ResumeStreamOptions = Pick<
  StreamSubmitOptions,
  'streamMode' | 'streamSubgraphs' | 'streamResumable' | 'context' | 'config'
>;

export type StreamContextType = {
  client: Client<StateType>;
  authenticatedFetch: typeof fetch;
  /** Share this scope's credential refresh with nested chat surfaces. */
  refreshClientSecret: () => Promise<ResolvedClientSecret>;
  apiUrl: string;
  assistantId: string;
  /** Persisted conversation scope; may differ from the initial session mount scope. */
  projectId?: string;
  /** True when a saved scope (including no Project) overrides the mount defaults. */
  projectScopeResolved?: boolean;
  /** False while restoring a thread's conversation and Project scope. */
  runtimeScopeReady: boolean;
  apiKey: string;
  organizationId?: string;
  threadId: string | null;
  conversationId: string | null;
  connectorBindingIds: string[];
  threadGoal: ThreadGoal | null;
  contextUsageByAgentKey: ThreadContextUsageByAgentKey;
  values: StateType;
  messages: ChatKitAIMessage[];
  historyMessageLoadVersion: number;
  historyMessagePagination: HistoryMessagePaginationState;
  historyLoad: ThreadHistoryState;
  todos: TodoListSnapshot | null;
  runtimeActivities: RuntimeActivitiesState;
  pendingFollowUps: PendingFollowUp[];
  pendingRequestUserInput: PendingRequestUserInput | null;
  pendingHITLRequest: PendingHITLRequest | null;
  isLoading: boolean;
  /** Raw thread interruption, including cancellation; does not imply work is running or will resume. */
  isThreadInterrupted?: boolean;
  /** @deprecated Output stays live while pausing; always false. */
  isDisplayPaused?: boolean;
  /** @deprecated Legacy display snapshots are ignored; always null. */
  displayPause?: ThreadDisplayPause | null;
  /** @deprecated No display freeze remains to release. */
  resumeDisplay: () => Promise<void>;
  isReady: boolean;
  error: unknown;
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
  loadThread: (threadId: string) => Promise<void>;
  loadConversationMessages: (
    recordId: string,
    threadId?: string,
  ) => Promise<ChatKitAIMessage[]>;
  loadMoreConversationMessages: () => Promise<ChatKitAIMessage[]>;
  /** Reconcile an already-known execution without interrupting the parent stream. */
  reconcileAgentRun?: (threadId: string, run: AgentRunInfo) => void;
  submit: (
    values?: StreamRunInput | null,
    options?: StreamSubmitOptions,
  ) => Promise<void>;
  stop: (runId?: string) => Promise<void>;
  /** Current stream execution id, or null until the first assistant event. */
  activeRunId: string | null;
  pauseRun: (runId: string) => Promise<void>;
  resumeRun: (runId: string, pauseId: string) => Promise<void>;
  reset: (
    newThreadId?: string | null,
    initialMessages?: ChatKitAIMessage[],
    options?: { suppressThreadChange?: boolean },
  ) => void;
  removePendingFollowUp: (id: string) => void;
  canSendPendingFollowUpNow: (id: string) => boolean;
  sendPendingFollowUpNow: (id: string) => Promise<void>;
  promotePendingFollowUpToSteer: (id: string) => Promise<void>;
  submitRequestUserInput: (answers: RequestUserInputAnswer[]) => void;
  submitHITLDecision: (decisions: HITLDecision[]) => void;
  stopRuntimeActivityItem: (
    providerId: RuntimeActivityProviderId,
    itemId: string,
  ) => Promise<void>;
  setThreadId: (threadId: string | null) => void;
  setConnectorBindingIds: (bindingIds: string[]) => Promise<void>;
};

export type PersistedChatMessage = ChatMessage &
  MessageMetadataContainer & {
    agentRuns?: unknown;
    attachments?: unknown;
    fileAssets?: unknown;
    followUpMode?: FollowUpBehavior;
    followUpStatus?: FollowUpStatus;
    targetExecutionId?: string | null;
    visibleAt?: string | null;
    thirdPartyMessage?: unknown;
    taskSummary?: unknown;
  };
