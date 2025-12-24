import type { ToolCall } from "@langchain/core/messages/tool";

export enum ChatMessageTypeEnum {
  // LOG = 'log',
  MESSAGE = 'message',
  EVENT = 'event'
}

/**
 * https://js.langchain.com/docs/how_to/streaming/#event-reference
 */
export enum ChatMessageEventTypeEnum {
  ON_CONVERSATION_START = 'on_conversation_start',
  ON_CONVERSATION_END = 'on_conversation_end',
  ON_MESSAGE_START = 'on_message_start',
  ON_MESSAGE_END = 'on_message_end',
  ON_TOOL_START = 'on_tool_start',
  ON_TOOL_END = 'on_tool_end',
  ON_TOOL_ERROR = 'on_tool_error',
  /**
   * Step message in tool call
   */
  ON_TOOL_MESSAGE = 'on_tool_message',
  ON_AGENT_START = 'on_agent_start',
  ON_AGENT_END = 'on_agent_end',
  ON_RETRIEVER_START = 'on_retriever_start',
  ON_RETRIEVER_END = 'on_retriever_end',
  ON_RETRIEVER_ERROR = 'on_retriever_error',
  ON_INTERRUPT = 'on_interrupt',
  ON_ERROR = 'on_error',
  ON_CHAT_EVENT = 'on_chat_event',

  ON_CLIENT_EFFECT = 'on_client_effect',
}

/**
 * Category of step message: determines the display components of computer use
 */
export enum ChatMessageStepCategory {
  /**
   * List of items: urls, files, etc.
   */
  List = 'list',
  /**
   * Websearch results
   */
  WebSearch = 'web_search',
  /**
   * Files list
   */
  Files = 'files',
  /**
   * View a file
   */
  File = 'file',
  /**
   * Program Execution
   */
  Program = 'program',
  /**
   * Iframe
   */
  Iframe = 'iframe',

  Memory = 'memory',

  Tasks = 'tasks',

  /**
   * Knowledges (knowledge base retriever results)
   */
  Knowledges = 'knowledges'
}

/**
 * Step message type, in canvas and ai message.
 */
export type TChatMessageStep<T = any> = TMessageComponent<TMessageComponentStep<T>>

export type ImageDetail = "auto" | "low" | "high";
export type MessageContentText = {
    type: "text";
    text: string;
};
export type MessageContentImageUrl = {
    type: "image_url";
    image_url: string | {
        url: string;
        detail?: ImageDetail;
    };
};

/**
 * Similar to {@link MessageContentText} | {@link MessageContentImageUrl}, which together form {@link MessageContentComplex}
 */
export type TMessageContentComponent<T extends object = object> = {
  id: string
  type: 'component'
  data: TMessageComponent<T>
  xpertName?: string
  agentKey?: string;
}

/**
 * Defines the data type of the sub-message of `component` type in the message `content` {@link MessageContentComplex}
 */
export type TMessageComponent<T extends object = object> = T & {
  id?: string
  category: 'Dashboard' | 'Computer' | 'Tool'
  type?: string
  created_date?: Date | string
}

export type TMessageContentText = {
  id?: string
  xpertName?: string
  agentKey?: string
  type: "text";
  text: string;
};
export type TMessageContentMemory = {
  id?: string
  agentKey?: string
  type: "memory";
  data: any[];
};
export type TMessageContentReasoning = {
  id?: string
  xpertName?: string
  agentKey?: string
  type: "reasoning";
  text: string;
};
/**
 * Enhance {@link MessageContentComplex} in Langchain.js
 */
export type TMessageContentComplex = (TMessageContentText | TMessageContentReasoning | MessageContentImageUrl | TMessageContentComponent | TMessageContentMemory | (Record<string, any> & {
  type?: "text" | "image_url" | string;
}) | (Record<string, any> & {
  type?: never;
})) & {
  id?: string
  xpertName?: string
  agentKey?: string;
  created_date?: Date | string
}

/**
 * Enhance {@link MessageContent} in Langchain.js
 * 
 * @deprecated use {@link TMessageItems} instead
 */
export type TMessageContent = string | TMessageContentComplex[];

export type TMessageComponentIframe = {
  type: 'iframe'
  title: string
  url?: string
  data?: {
    url?: string
  }
}

export type TMessageComponentStep<T = unknown> = {
  type: ChatMessageStepCategory
  toolset: string
  toolset_id: string
  tool?: string
  title: string
  message: string
  status: 'success' | 'fail' | 'running'
  created_date: Date | string
  end_date: Date | string
  error?: string
  data?: T
  input?: any
  output?: string
  artifact?: any
}

/**
 * Data type for chat event message
 */
export type TChatEventMessage = {
  type?: string
  title?: string
  message?: string
  status?: 'success' | 'fail' | 'running'
  created_date?: Date | string
  end_date?: Date | string
  error?: string
}

export interface ChatkitMessage {
  status?: string
  content: TMessageItems
  reasoning?: TMessageContentReasoning[]
  type: 'user' | 'assistant' | 'system' | 'tool' | 'event'
  id: string
}

export type TMessageItems = TMessageContentComplex[];


export const STATE_VARIABLE_HUMAN = 'human'

/**
 * Human input message, include parameters and attachments
 */
export type TChatRequestHuman = {
  input?: string
  files?: Partial<File>[]
  [key: string]: unknown
}

/**
 * Command to resume with streaming after human decision
 */
export type TInterruptCommand = {
  resume?: any
  update?: any
  toolCalls?: ToolCall[]
  agentKey?: string
}

export type TChatRequest = {
  /**
   * The human input, include parameters
   */
  input: TChatRequestHuman
  /**
   * Custom graph state
   */
  state?: {[STATE_VARIABLE_HUMAN]: TChatRequestHuman} & Record<string, any>
  agentKey?: string
  projectId?: string
  conversationId?: string
  environmentId?: string
  id?: string
  executionId?: string
  confirm?: boolean
  command?: TInterruptCommand
  retry?: boolean
}