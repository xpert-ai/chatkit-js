import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryState } from 'nuqs';
import {
  Client,
  type Checkpoint,
  type Command,
  type Config,
  type StreamMode,
} from '@langchain/langgraph-sdk';
import type { Message } from '@langchain/core/messages';
import { type ToolCall } from '@langchain/core/messages/tool';
import { ChatMessageEventTypeEnum, ChatMessageTypeEnum, type ClientToolMessageInput, type ClientToolRequest, type ClientToolResponse, type TChatRequest, type TMessageContent } from '@xpert-ai/chatkit-types';
import { appendMessageContent } from '../lib/message';
import { useParentMessenger, type ParentMessenger } from '../hooks/useParentMessenger';

type ChatKitAIMessage = Message & { executionId?: string };

export type StateType = { messages: ChatKitAIMessage[] };

export type StreamSubmitOptions = {
  optimisticValues?:
    | Partial<StateType>
    | ((prev: StateType) => Partial<StateType>);
  context?: Record<string, unknown>;
  command?: Command;
  config?: Config;
  checkpoint?: Omit<Checkpoint, 'thread_id'> | null;
  streamMode?: StreamMode | StreamMode[];
  streamSubgraphs?: boolean;
  streamResumable?: boolean;
  threadId?: string;
};

export type StreamContextType = {
  client: Client<StateType>;
  assistantId: string;
  threadId: string | null;
  values: StateType;
  messages: ChatKitAIMessage[];
  isLoading: boolean;
  error: unknown;
  submit: (
    values?: TChatRequest | null,
    options?: StreamSubmitOptions,
  ) => Promise<void>;
  stop: () => void;
  reset: (newThreadId?: string | null) => void;
  setThreadId: (threadId: string | null) => void;
};

const StreamContext = createContext<StreamContextType | undefined>(undefined);

const defaultApiUrl =
  (import.meta.env.VITE_CHATKIT_API_BASE as string | undefined) ??
  'https://api.mtda.cloud/api/ai';
const defaultAssistantId =
  (import.meta.env.VITE_CHATKIT_ASSISTANT_ID as string | undefined) ?? '';
const defaultApiKey =
  (import.meta.env.VITE_CHATKIT_API_KEY as string | undefined) ?? null;

function applyOptimisticValues(
  prev: StateType,
  optimistic:
    | Partial<StateType>
    | ((prev: StateType) => Partial<StateType>),
): StateType {
  const update = typeof optimistic === 'function' ? optimistic(prev) : optimistic;
  return { ...prev, ...update };
}

function parseEventData(raw: unknown) {
  if (typeof raw === 'string') {
    if (!raw || raw.startsWith(':')) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

type StreamChunk = { id?: string; event: string; data: unknown };

function createMessageId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function normalizeMessageType(value: unknown): ChatKitAIMessage['type'] | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase();
  switch (normalized) {
    case 'user':
    case 'human':
      return 'human';
    case 'assistant':
    case 'ai':
      return 'ai';
    case 'system':
      return 'system';
    case 'tool':
      return 'tool';
    default:
      return value as ChatKitAIMessage['type'];
  }
}

function isAssistantMessage(message: ChatKitAIMessage | undefined) {
  return (
    message?.type === 'ai' ||
    (typeof message?.type === 'string' &&
      message.type.toLowerCase() === 'assistant')
  );
}

function appendMessages(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  nextMessages: ChatKitAIMessage[],
) {
  if (nextMessages.length === 0) return;
  setValues((prev) => ({
    ...prev,
    messages: [...(prev.messages ?? []), ...nextMessages],
  }));
}

function appendStreamText(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  text: string,
) {
  if (!text) return;
  setValues((prev) => {
    const messages = prev.messages ?? [];
    const last = messages[messages.length - 1];

    if (last && isAssistantMessage(last) && typeof last.content === 'string') {
      const nextMessages = [...messages];
      nextMessages[messages.length - 1] = {
        ...last,
        content: last.content + text,
      };
      return { ...prev, messages: nextMessages };
    }

    const newMessage: ChatKitAIMessage = {
      id: createMessageId(),
      type: 'ai',
      content: text,
    };
    return { ...prev, messages: [...messages, newMessage] };
  });
}

function appendStreamTextToLatest(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  text: string,
) {
  if (!text) return;
  setValues((prev) => {
    const messages = prev.messages ?? [];
    if (messages.length === 0) {
      const newMessage: ChatKitAIMessage = {
        id: createMessageId(),
        type: 'ai',
        content: text,
      };
      return { ...prev, messages: [newMessage] };
    }

    const last = messages[messages.length - 1];
    let nextContent: ChatKitAIMessage['content'];
    if (typeof last.content === 'string') {
      nextContent = last.content + text;
    } else if (Array.isArray(last.content)) {
      nextContent = [...last.content, text];
    } else if (last.content == null) {
      nextContent = text;
    } else {
      nextContent = `${String(last.content)}${text}`;
    }

    const nextMessages = [...messages];
    nextMessages[messages.length - 1] = { ...last, content: nextContent };
    return { ...prev, messages: nextMessages };
  });
}

function createMessageFromData(data: unknown): ChatKitAIMessage | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    return { id: createMessageId(), type: 'ai', content: data };
  }
  if (Array.isArray(data) || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  const content =
    'text' in raw ? (raw as { text?: Message['content'] }).text : data;
  const type =
    normalizeMessageType(raw.type) ??
    normalizeMessageType(raw.role) ??
    'ai';
  const id = typeof raw.id === 'string' ? raw.id : createMessageId();
  const executionId =
    typeof raw.executionId === 'string' ? raw.executionId : undefined;

  return { id, type, content, executionId };
}

function extractMessageMeta(data: unknown) {
  if (!data || typeof data !== 'object') return {};
  const raw = data as Record<string, unknown>;
  const meta: {
    id?: string;
    type?: ChatKitAIMessage['type'];
    content?: ChatKitAIMessage['content'];
  } = {};

  if (typeof raw.id === 'string') meta.id = raw.id;
  meta.type = normalizeMessageType(raw.type ?? raw.role);
  if ('content' in raw) {
    meta.content = (raw as { content?: Message['content'] }).content;
  }

  return meta;
}

function extractExecutionId(data: unknown) {
  if (!data || typeof data !== 'object') return undefined;
  const raw = data as Record<string, unknown>;
  const value = raw.executionId ?? raw.execution_id;
  return typeof value === 'string' ? value : undefined;
}

function updateLatestMessage(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  updater: (message: Message) => Message,
) {
  setValues((prev) => {
    const messages = prev.messages ?? [];
    if (messages.length === 0) return prev;
    const nextMessages = [...messages];
    nextMessages[messages.length - 1] = updater(nextMessages[messages.length - 1]);
    return { ...prev, messages: nextMessages };
  });
}

function applyMessageData(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  data: unknown,
) {
  if (typeof data === 'string') {
    appendStreamText(setValues, data);
    return;
  }
  if (Array.isArray(data)) {
    const messages = data
      .map((item) => createMessageFromData(item))
      .filter((item): item is Message => Boolean(item));
    appendMessages(setValues, messages);
    return;
  }

  const message = createMessageFromData(data);
  if (message) {
    appendMessages(setValues, [message]);
  }
}

function appendMessageComponent(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  content: TMessageContent) {
  updateLatestMessage(setValues, (lastM) => {
      appendMessageContent(lastM as any, content)
      return {
        ...lastM
      }
    })
}

function normalizeClientToolRequest(value: unknown): ClientToolRequest | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as {
    clientToolCalls?: unknown;
    toolCalls?: unknown;
    tool_calls?: unknown;
  };
  const calls =
    (Array.isArray(raw.clientToolCalls) && raw.clientToolCalls) ||
    (Array.isArray(raw.toolCalls) && raw.toolCalls) ||
    (Array.isArray(raw.tool_calls) && raw.tool_calls);
  if (!calls) return null;
  return { clientToolCalls: calls as ToolCall[] };
}

function collectClientToolRequests(payload: unknown): ClientToolRequest[] {
  if (!payload || typeof payload !== 'object') return [];
  const raw = payload as { tasks?: unknown };
  if (!Array.isArray(raw.tasks)) return [];

  const requests: ClientToolRequest[] = [];
  for (const task of raw.tasks) {
    if (!task || typeof task !== 'object') continue;
    const interrupts = (task as { interrupts?: unknown }).interrupts;
    if (!Array.isArray(interrupts)) continue;
    for (const interrupt of interrupts) {
      if (!interrupt || typeof interrupt !== 'object') continue;
      const request = normalizeClientToolRequest(
        (interrupt as { value?: unknown }).value,
      );
      if (request) requests.push(request);
    }
  }

  return requests;
}

function normalizeToolMessagesResponse(response: unknown): ClientToolMessageInput | null {
  console.log('Tool message response:', response);
  if (!response) return null;
  if (typeof response === 'object' && response !== null) {
    const raw = response as ClientToolMessageInput;
    return {
      tool_call_id: raw.tool_call_id,
      name: raw.name,
      content: raw.content,
      status: raw.status,
    }
  }
  return null
}

function applyStreamEvent(
  chunk: StreamChunk,
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  setError: React.Dispatch<React.SetStateAction<unknown>>,
  sendEvent: ParentMessenger['sendEvent'],
  onInterrupt?: (data: unknown) => void | Promise<void>,
  onExecutionId?: (executionId: string | undefined) => void,
) {
  const parsed = parseEventData(chunk.data);
  if (parsed == null) return;

  console.log('Stream event:', chunk.event, parsed);

  if (chunk.event === 'error') {
    const message =
      typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    setError(new Error(message));
    return;
  }

  if (typeof parsed === 'object' && parsed !== null && 'messages' in parsed) {
    const nextMessages = (parsed as { messages?: Message[] }).messages;
    if (Array.isArray(nextMessages)) {
      setValues((prev) => ({ ...prev, messages: nextMessages }));
    }
    return;
  }

  if (typeof parsed === 'string') {
    appendStreamText(setValues, parsed);
    return;
  }

  if (Array.isArray(parsed)) {
    const messages = parsed
      .map((item) => createMessageFromData(item))
      .filter((item): item is Message => Boolean(item));
    appendMessages(setValues, messages);
    return;
  }

  if (typeof parsed !== 'object' || parsed == null) return;

  const payload = parsed as {
    type: ChatMessageTypeEnum;
    event?: ChatMessageEventTypeEnum;
    data?: unknown;
  };

  const payloadType: ChatMessageTypeEnum = payload.type

  if (payloadType === ChatMessageTypeEnum.MESSAGE) {
    if (typeof payload.data === 'string') {
      appendStreamTextToLatest(setValues, payload.data);
      return;
    }
    appendMessageComponent(setValues, payload.data as TMessageContent);
    return;
  }

  if (payloadType === ChatMessageTypeEnum.EVENT) {
    const eventType =
      (typeof payload.event === 'string' ? payload.event.toLowerCase() : '') as ChatMessageEventTypeEnum;
    const meta = extractMessageMeta(payload.data);

    switch (eventType) {
      case ChatMessageEventTypeEnum.ON_CONVERSATION_START:
      case ChatMessageEventTypeEnum.ON_CONVERSATION_END: {
        const eventData = payload.data as { messages?: ChatKitAIMessage[] } | null;
        if (eventData && Array.isArray(eventData.messages)) {
          setValues((prev) => ({ ...prev, messages: eventData.messages ?? [] }));
        }
        break;
      }
      case ChatMessageEventTypeEnum.ON_MESSAGE_START: {
        const executionId = extractExecutionId(payload.data);
        if (executionId) {
          onExecutionId?.(executionId);
        }
        const message: ChatKitAIMessage = {
          id: meta.id ?? createMessageId(),
          type: meta.type ?? 'ai',
          content: meta.content ?? '',
          executionId,
        };
        setValues((prev) => {
          const messages = prev.messages ?? [];
          const last = messages[messages.length - 1];
          if (last && isAssistantMessage(last)) {
            if (executionId && last.executionId === executionId) {
              const nextMessages = [...messages];
              const nextLast: ChatKitAIMessage = { ...last, executionId };
              if (meta.id) nextLast.id = meta.id;
              if (meta.type) nextLast.type = meta.type;
              if (
                meta.content !== undefined &&
                (last.content == null ||
                  (typeof last.content === 'string' && last.content.length === 0))
              ) {
                nextLast.content = meta.content;
              }
              nextMessages[messages.length - 1] = nextLast;
              return { ...prev, messages: nextMessages };
            }
            if (
              typeof last.content === 'string' &&
              last.content.length === 0
            ) {
              const nextMessages = [...messages];
              nextMessages[messages.length - 1] = message;
              return { ...prev, messages: nextMessages };
            }
          }
          return { ...prev, messages: [...messages, message] };
        });
        break;
      }
      case ChatMessageEventTypeEnum.ON_MESSAGE_END: {
        if (
          meta.content === undefined &&
          meta.id === undefined &&
          meta.type === undefined
        ) {
          break;
        }
        updateLatestMessage(setValues, (message) => {
          const next = { ...message };
          if (meta.id) next.id = meta.id;
          if (meta.type) next.type = meta.type;
          if (meta.content !== undefined) next.content = meta.content;
          return next;
        });
        break;
      }
      case ChatMessageEventTypeEnum.ON_INTERRUPT: {
        if (onInterrupt) {
          const maybePromise = onInterrupt(payload.data);
          if (
            maybePromise &&
            typeof (maybePromise as Promise<void>).catch === 'function'
          ) {
            (maybePromise as Promise<void>).catch(setError);
          }
        }
        break;
      }
      case ChatMessageEventTypeEnum.ON_CLIENT_EFFECT: {
        const toolCall = payload.data as ToolCall;
        sendEvent('public_event', ['effect', {name: toolCall.name, data: toolCall.args}]);
        break
      }
      default:
        break;
    }
    return;
  }

  if ('data' in payload) {
    applyMessageData(setValues, payload.data);
    return;
  }

  const fallbackMessage = createMessageFromData(parsed);
  if (fallbackMessage) {
    appendMessages(setValues, [fallbackMessage]);
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
}) => {
  const [threadId, setThreadId] = useQueryState('threadId');
  const [values, setValues] = useState<StateType>({ messages: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);
  const submitRef = useRef<StreamContextType['submit'] | null>(null);
  const lastStreamOptionsRef = useRef<
    Pick<StreamSubmitOptions, 'streamMode' | 'streamSubgraphs' | 'streamResumable'>
  >({});
  const lastExecutionIdRef = useRef<string | null>(null);
  const { isParentAvailable, sendCommand, sendEvent } = useParentMessenger();

  const client = useMemo(
    () => new Client<StateType>({ apiUrl, apiKey, defaultHeaders: {
      'Authorization': apiKey ? `Bearer ${apiKey}` : undefined,
    } }),
    [apiKey, apiUrl],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const reset = useCallback((newThreadId?: string | null) => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setError(null);
    setValues({ messages: [] });
    lastExecutionIdRef.current = null;
    if (newThreadId !== undefined) {
      setThreadId(newThreadId);
    }
  }, [setThreadId]);

  const handleInterrupt = useCallback(
    async (data: unknown) => {
      if (!isParentAvailable) return;
      const requests = collectClientToolRequests(data);
      if (requests.length === 0) return;

      const toolMessages: ClientToolMessageInput[] = [];
      for (const request of requests) {
        const calls = request.clientToolCalls ?? [];
        for (const call of calls) {
          let response: unknown;
          try {
            response = await sendCommand('onClientToolCall', {
              name: call.name,
              params: call.args,
              id: call.id,
            });
          } catch (requestError) {
            setError(requestError);
            continue;
          }

          const toolMessage = normalizeToolMessagesResponse(response);
          if (!toolMessage) continue;

          toolMessages.push(toolMessage);
        }
      }

      if (toolMessages.length > 0) {
        await submitRef.current?.({
            input: {},
            command: {
              resume: {
                  toolMessages: toolMessages,
              } as ClientToolResponse
            },
            executionId: lastExecutionIdRef.current ?? undefined
          },
          lastStreamOptionsRef.current,
        );
      }
    },
    [isParentAvailable, sendCommand, setError],
  );

  const submit = useCallback(
    async (
      input?: TChatRequest | null,
      options?: StreamSubmitOptions,
    ) => {
      setError(null);
      lastStreamOptionsRef.current = {
        streamMode: options?.streamMode,
        streamSubgraphs: options?.streamSubgraphs,
        streamResumable: options?.streamResumable,
      };
      const optimistic = options?.optimisticValues;
      if (optimistic) {
        setValues((prev) => applyOptimisticValues(prev, optimistic));
      }

      let nextThreadId = threadId ?? null;
      const desiredThreadId = options?.threadId ?? null;
      if (!nextThreadId && desiredThreadId) {
        const created = await client.threads.create({
          threadId: desiredThreadId,
          ifExists: 'raise',
        });
        nextThreadId = created.thread_id;
        setThreadId(created.thread_id);
      }
      if (!nextThreadId) {
        const created = await client.threads.create();
        nextThreadId = created.thread_id;
        setThreadId(created.thread_id);
      }
      if (desiredThreadId && desiredThreadId !== nextThreadId) {
        nextThreadId = desiredThreadId;
        setThreadId(desiredThreadId);
      }

      const abortController = new AbortController();
      abortRef.current?.abort();
      abortRef.current = abortController;
      setIsLoading(true);

      try {
        const stream = client.runs.stream(nextThreadId, assistantId, {
          input: input ?? null,
          context: options?.context,
          command: options?.command,
          config: options?.config,
          checkpoint: options?.checkpoint ?? undefined,
          streamMode: options?.streamMode,
          streamSubgraphs: options?.streamSubgraphs,
          streamResumable: options?.streamResumable,
          signal: abortController.signal,
        });

        for await (const chunk of stream) {
          applyStreamEvent(
            chunk as StreamChunk,
            setValues,
            setError,
            sendEvent,
            handleInterrupt,
            (executionId) => {
              if (executionId) {
                lastExecutionIdRef.current = executionId;
              }
            },
          );
        }
      } catch (streamError) {
        if (!(streamError instanceof DOMException && streamError.name === 'AbortError')) {
          setError(streamError);
        }
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [assistantId, client, handleInterrupt, setThreadId, threadId],
  );

  submitRef.current = submit;

  const value: StreamContextType = {
    client,
    assistantId,
    threadId: threadId ?? null,
    values,
    messages: values.messages ?? [],
    isLoading,
    error,
    submit,
    stop,
    reset,
    setThreadId,
  };

  return (
    <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
  );
};

export const StreamProvider: React.FC<{
  children: ReactNode;
  apiKey?: string | null;
  apiUrl?: string;
  assistantId?: string;
}> = ({ children, apiKey, apiUrl, assistantId }) => {
  return (
    <StreamSession
      apiKey={apiKey ?? defaultApiKey}
      apiUrl={apiUrl ?? defaultApiUrl}
      assistantId={assistantId ?? defaultAssistantId}
    >
      {children}
    </StreamSession>
  );
};

export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error('useStreamContext must be used within a StreamProvider');
  }
  return context;
};

export default StreamContext;
