import type { ToolCall } from '@langchain/core/messages/tool';
import type { Types } from '@a2ui/lit/0.8';
import type { FollowUpBehavior } from './options';
import type { ChatKitCommandSource } from './commands';
import {
  CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
  ChatMessageEventTypeEnum,
  ChatMessageStepCategory,
  ChatMessageTypeEnum,
  STATE_VARIABLE_HUMAN,
} from './constants.js';

/**
 * Encapsulate multi-agent message events
 */
export interface ChatEventEnvelope<T = unknown> {
  type: ChatMessageTypeEnum;
  event?: ChatMessageEventTypeEnum;
  tags: string[];
  data: T;
}

/**
 * Step message type, in canvas and ai message.
 */
export type TChatMessageStep<T = any> = TMessageComponent<
  TMessageComponentStep<T>
>;

export type ImageDetail = 'auto' | 'low' | 'high';
export type MessageContentText = {
  type: 'text';
  text: string;
};
export type MessageContentImageUrl = {
  type: 'image_url';
  image_url:
    | string
    | {
        url: string;
        detail?: ImageDetail;
      };
};

/**
 * Similar to {@link MessageContentText} | {@link MessageContentImageUrl}, which together form {@link MessageContentComplex}
 */
export type TMessageContentComponent<T extends object = object> = {
  id: string;
  type: 'component';
  data: TMessageComponent<T>;
  xpertName?: string;
  agentKey?: string;
};

/**
 * Defines the data type of the sub-message of `component` type in the message `content` {@link MessageContentComplex}
 */
export type TMessageComponent<T extends object = object> = T & {
  id?: string;
  category: 'Dashboard' | 'Computer' | 'Tool';
  type?: string;
  created_date?: Date | string;
};

export type TMessageComponentWidgetItem = {
  name: string;
  config: Types.Surface;
  values?: Record<string, unknown>;
};

export type TMessageComponentWidgetData = {
  type: 'Widget';
  mode?: string;
  widgets: TMessageComponentWidgetItem[];
  executionId?: string;
};

export type TMessageComponentWidget =
  TMessageComponent<TMessageComponentWidgetData>;

export type TMessageContentWidget =
  TMessageContentComponent<TMessageComponentWidgetData>;

export type TMessageContentText = {
  id?: string;
  xpertName?: string;
  agentKey?: string;
  type: 'text';
  text: string;
};
export type TMessageContentMemory = {
  id?: string;
  agentKey?: string;
  type: 'memory';
  data: any[];
};
export type TMessageContentReasoning = {
  id?: string;
  xpertName?: string;
  agentKey?: string;
  type: 'reasoning';
  text: string;
};
/**
 * Enhance {@link MessageContentComplex} in Langchain.js
 */
export type TMessageContentComplex = (
  | TMessageContentText
  | TMessageContentReasoning
  | MessageContentImageUrl
  | TMessageContentComponent
  | TMessageContentMemory
  | (Record<string, any> & {
      type?: 'text' | 'image_url' | string;
    })
  | (Record<string, any> & {
      type?: never;
    })
) & {
  id?: string;
  xpertName?: string;
  agentKey?: string;
  created_date?: Date | string;
};

/**
 * Enhance {@link MessageContent} in Langchain.js
 *
 * @deprecated use {@link TMessageItems} instead
 */
export type TMessageContent = string | TMessageContentComplex[];

export type TMessageComponentIframe = {
  type: 'iframe';
  title: string;
  url?: string;
  data?: {
    url?: string;
  };
};

export type TMessageComponentStep<T = unknown> = {
  type: ChatMessageStepCategory;
  toolset: string;
  toolset_id: string;
  tool?: string;
  title: string;
  message: string;
  status: 'success' | 'fail' | 'running';
  created_date: Date | string;
  end_date: Date | string;
  error?: string;
  data?: T;
  input?: any;
  output?: unknown;
  artifact?: any;
};

/**
 * Data type for chat event message
 */
export type TChatEventMessage = {
  type?: string;
  title?: string;
  message?: string;
  status?: 'success' | 'fail' | 'running';
  created_date?: Date | string;
  end_date?: Date | string;
  error?: string;
};

export interface ChatkitMessage {
  status?: string;
  content: TMessageItems | string;
  reasoning?: TMessageContentReasoning[];
  type: 'user' | 'assistant' | 'system' | 'tool' | 'event';
  id: string;
  followUpMode?: FollowUpBehavior;
  followUpStatus?: 'pending' | 'consumed' | 'canceled';
  targetExecutionId?: string | null;
  visibleAt?: string | Date | null;
}

export type TMessageItems = TMessageContentComplex[];

export type ChatKitReferenceBase = {
  id?: string;
  label?: string;
  text: string;
};

export type ChatKitCodeReference = ChatKitReferenceBase & {
  type: 'code';
  path: string;
  startLine: number;
  endLine: number;
  language?: string;
  taskId?: string;
};

export type ChatKitQuoteReference = ChatKitReferenceBase & {
  type: 'quote';
  messageId?: string;
  source?: string;
};

export type ChatKitImageReference = ChatKitReferenceBase & {
  type: 'image';
  fileId?: string;
  url?: string;
  mimeType?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
};

export type ChatKitReference =
  | ChatKitCodeReference
  | ChatKitQuoteReference
  | ChatKitImageReference;

export type ChatKitReferenceCompositionMode = 'compose' | 'preserve';

export type RuntimeCapabilitiesSelectionSet = {
  skills: {
    workspaceId?: string;
    ids: string[];
  };
  plugins: {
    nodeKeys: string[];
  };
  subAgents?: {
    nodeKeys: string[];
  };
};

export type RuntimeCapabilitiesSelection = RuntimeCapabilitiesSelectionSet & {
  mode: 'allowlist';
  recommended?: RuntimeCapabilitiesSelectionSet;
};

/**
 * Human input message, include parameters and attachments
 */
export type TChatRequestHuman = {
  input?: string;
  files?: Partial<File>[];
  references?: ChatKitReference[];
  referenceComposition?: ChatKitReferenceCompositionMode;
  planMode?: boolean;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  commandSource?: ChatKitCommandSource;
  [key: string]: unknown;
};

/**
 * Command to resume with streaming after human decision
 */
export type TInterruptCommand = {
  resume?: any;
  update?: any;
  toolCalls?: ToolCall[];
  agentKey?: string;
};

export type TXpertChatState = {
  [STATE_VARIABLE_HUMAN]?: TChatRequestHuman;
} & Record<string, any>;

export type TXpertChatResumeDecision = {
  type: 'confirm' | 'reject';
  payload?: unknown;
};

export type TXpertChatInterruptPatch = Pick<
  TInterruptCommand,
  'agentKey' | 'toolCalls' | 'update'
>;

export type TXpertChatTarget = {
  aiMessageId?: string;
  executionId?: string;
};

export type TXpertChatResumeRequest = {
  action: 'resume';
  conversationId: string;
  target: TXpertChatTarget;
  decision: TXpertChatResumeDecision;
  patch?: TXpertChatInterruptPatch;
  state?: TXpertChatState;
};

export type TChatRequest = {
  /**
   * The human input, include parameters
   */
  input: TChatRequestHuman;
  /**
   * Custom graph state
   */
  state?: TXpertChatState;
  agentKey?: string;
  projectId?: string;
  conversationId?: string;
  environmentId?: string;
  id?: string;
  executionId?: string;
  confirm?: boolean;
  command?: TInterruptCommand;
  retry?: boolean;
  followUpMode?: FollowUpBehavior;
  /**
   * PRO: Sandbox Environment Id
   * PRO: @description Sandbox environment ID to force using the specified container.
   */
  sandboxEnvironmentId?: string;
};

/**
 * Data type for client effect message
 */
export type TClientEeffectMessage = {
  name: string;
  args: Record<string, any>;
  tool_call_id?: string;
  agentKey?: string;
  created_date?: Date | string;
};

// Thread context usage
export type TThreadContextUsageMetrics = {
  contextTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  embedTokens?: number;
  totalPrice?: number;
  currency?: string | null;
};

export type TThreadContextUsageEvent = {
  type: 'thread_context_usage';
  threadId: string;
  runId: string | null;
  agentKey: string;
  updatedAt: string;
  usage: TThreadContextUsageMetrics;
};

export type TFollowUpConsumedEvent = TChatEventMessage & {
  type: typeof CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED;
  mode: 'queue' | 'steer';
  messageIds: string[];
  clientMessageIds?: string[];
  executionId?: string | null;
  visibleAt?: string | null;
};
