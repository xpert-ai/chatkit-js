export enum ChatMessageTypeEnum {
  // LOG = 'log',
  MESSAGE = 'message',
  EVENT = 'event',
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
  Knowledges = 'knowledges',
}

export const STATE_VARIABLE_HUMAN = 'human';

export const CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED =
  'follow_up_consumed' as const;
