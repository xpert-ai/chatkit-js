import type { ToolCall } from '@langchain/core/messages/tool';
import type { Types } from '@a2ui/lit/0.8';
import type { FollowUpBehavior } from './options';
import type { ChatKitCommandSource } from './commands';
import type { LocalizedText } from './localized-text';
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
  executionId?: string;
  parentExecutionId?: string;
  runId?: string;
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
  /**
   * Standard A2UI server-to-client messages. New widget messages should use
   * this flat protocol shape so the UI can build and isolate surfaces at render time.
   */
  messages?: Types.ServerToClientMessage[];
  /**
   * @deprecated Legacy pre-resolved surface fallback. Prefer `messages`.
   */
  config?: Types.Surface;
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

/**
 * Declares who may use an MCP tool. `model` exposes the tool to the LLM;
 * `app` allows the rendered MCP App iframe to call it through the host bridge.
 */
export type TMcpAppVisibility = 'model' | 'app';

/**
 * CSP domains declared by an MCP App resource. The backend validates and
 * normalizes these values before ChatKit applies them to the iframe response.
 */
export type TMcpAppCsp = {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
  baseUriDomains?: string[];
};

/**
 * Permission grant value for browser features requested by an MCP App resource.
 * A boolean is enough for simple allow/deny cases; object values preserve
 * future protocol details without forcing ChatKit message migrations.
 */
export type TMcpAppPermissionGrant = boolean | Record<string, unknown>;

/**
 * Browser feature permissions requested by an MCP App resource. ChatKit should
 * keep deny-by-default behavior and only translate supported grants to iframe
 * `allow` attributes.
 */
export type TMcpAppPermissions = {
  camera?: TMcpAppPermissionGrant;
  microphone?: TMcpAppPermissionGrant;
  geolocation?: TMcpAppPermissionGrant;
  clipboardWrite?: TMcpAppPermissionGrant;
};

export type IconType = 'image' | 'svg' | 'font' | 'emoji' | 'lottie';

export type IconDefinition = {
  type: IconType;
  value: string;
  color?: string;
  size?: number;
  alt?: string;
  style?: Record<string, string>;
};

/**
 * Safe metadata needed to render an MCP App message. Chat history stores this
 * descriptor only; the app HTML is fetched from the short-lived backend app
 * instance using `appInstanceId`.
 */
export type TMessageComponentMcpAppData = {
  /** Component discriminator used by ChatKit renderers. */
  type: 'McpApp';
  /** Short-lived host-side instance that scopes resource and bridge access. */
  appInstanceId: string;
  /** Signed host token used to revive and authorize this app instance. */
  appInstanceToken?: string;
  /** MCP resource URI, normally `ui://...`, used to load the app HTML. */
  resourceUri: string;
  /** Tool that produced this app surface. */
  toolName: string;
  /** Provider/model tool-call id associated with the triggering call. */
  toolCallId?: string;
  /** Xpert toolset id used for authorization and MCP client lookup. */
  toolsetId?: string;
  /** MCP server name within a multi-server toolset. */
  serverName?: string;
  /** Xpert execution id that produced this message component. */
  executionId?: string;
  /** Display title shown by the ChatKit shell around the app. */
  title?: LocalizedText;
  /** Optional display description shown by the ChatKit shell around the app. */
  description?: LocalizedText;
  /** Optional display icon shown by the ChatKit shell around the app. */
  icon?: IconDefinition;
  /** Resource-level content security policy metadata. */
  csp?: TMcpAppCsp;
  /** Resource-level browser permission metadata. */
  permissions?: TMcpAppPermissions;
  /** Optional dedicated origin requested by the resource; may be ignored by v1 hosts. */
  domain?: string;
  /** Resource hint for whether the host should render a visible border. */
  prefersBorder?: boolean;
  /** Original tool input sent to the MCP App via `ui/notifications/tool-input`. */
  toolInput?: Record<string, unknown>;
  /** Visibility declared by the originating MCP tool. */
  visibility?: TMcpAppVisibility[];
  /** Current lifecycle status of the tool/app message. */
  status?: 'running' | 'success' | 'fail';
  /** Human-readable error captured while creating or rendering the app. */
  error?: string;
};

/**
 * MCP App data embedded as a ChatKit component message.
 */
export type TMessageComponentMcpApp =
  TMessageComponent<TMessageComponentMcpAppData>;

/**
 * MCP App component item in a LangChain-compatible complex message content
 * array.
 */
export type TMessageContentMcpApp =
  TMessageContentComponent<TMessageComponentMcpAppData>;

export type TMessageContentText = {
  id?: string;
  xpertName?: string;
  agentKey?: string;
  executionId?: string;
  parentExecutionId?: string;
  runId?: string;
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
  executionId?: string;
  parentExecutionId?: string;
  runId?: string;
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
  executionId?: string;
  parentExecutionId?: string;
  runId?: string;
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
 * Human input message, including uploaded file handles and references.
 */
export type TChatRequestHuman = {
  input?: string;
  /**
   * Uploaded file handles submitted with the message. ChatKit UI now sends
   * AgentFile/FileAsset-shaped objects here; raw browser File objects should be
   * uploaded before submission.
   */
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

export type ThreadGoalStatus =
  | 'active'
  | 'paused'
  | 'blocked'
  // Reserved for future usage-quota enforcement. The backend does not emit this status yet.
  | 'usage_limited'
  | 'budget_limited'
  | 'complete';

export type ThreadGoal = {
  id?: string;
  conversationId?: string;
  threadId: string;
  objective: string;
  status: ThreadGoalStatus;
  tokensUsed: number;
  elapsedSeconds: number;
  continuationCount: number;
  statusUpdatedAt?: string | Date | null;
  completedAt?: string | Date | null;
  blockedAt?: string | Date | null;
};

export type TThreadGoalUpdatedEvent = {
  type: 'thread_goal_updated';
  conversationId?: string;
  threadId: string;
  goal: ThreadGoal;
  updatedAt: string;
};

export type TThreadGoalClearedEvent = {
  type: 'thread_goal_cleared';
  conversationId?: string;
  threadId: string;
  updatedAt: string;
};

export type TFollowUpConsumedEvent = TChatEventMessage & {
  type: typeof CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED;
  mode: 'queue' | 'steer';
  messageIds: string[];
  clientMessageIds?: string[];
  executionId?: string | null;
  visibleAt?: string | null;
};
