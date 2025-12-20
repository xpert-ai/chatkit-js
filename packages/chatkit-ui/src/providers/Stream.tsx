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
  type Message,
  type StreamMode,
} from '@langchain/langgraph-sdk';
import { ChatMessageEventTypeEnum, ChatMessageTypeEnum, type TMessageContent } from '@xpert-ai/chatkit';
import { appendMessageContent } from '../lib/message';

export type StateType = { messages: Message[] };

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
  messages: Message[];
  isLoading: boolean;
  error: unknown;
  submit: (
    values?: Record<string, unknown> | null,
    options?: StreamSubmitOptions,
  ) => Promise<void>;
  stop: () => void;
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

function normalizeMessageType(value: unknown): Message['type'] | undefined {
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
      return value as Message['type'];
  }
}

function isAssistantMessage(message: Message | undefined) {
  return (
    message?.type === 'ai' ||
    (typeof message?.type === 'string' &&
      message.type.toLowerCase() === 'assistant')
  );
}

function appendMessages(
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  nextMessages: Message[],
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

    const newMessage: Message = {
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
      const newMessage: Message = {
        id: createMessageId(),
        type: 'ai',
        content: text,
      };
      return { ...prev, messages: [newMessage] };
    }

    const last = messages[messages.length - 1];
    let nextContent: Message['content'];
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

function createMessageFromData(data: unknown): Message | null {
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

  return { id, type, content };
}

function extractMessageMeta(data: unknown) {
  if (!data || typeof data !== 'object') return {};
  const raw = data as Record<string, unknown>;
  const meta: {
    id?: string;
    type?: Message['type'];
    content?: Message['content'];
  } = {};

  if (typeof raw.id === 'string') meta.id = raw.id;
  meta.type = normalizeMessageType(raw.type ?? raw.role);
  if ('content' in raw) {
    meta.content = (raw as { content?: Message['content'] }).content;
  }

  return meta;
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

function applyStreamEvent(
  chunk: StreamChunk,
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  setError: React.Dispatch<React.SetStateAction<unknown>>,
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
        const eventData = payload.data as { messages?: Message[] } | null;
        if (eventData && Array.isArray(eventData.messages)) {
          setValues((prev) => ({ ...prev, messages: eventData.messages ?? [] }));
        }
        break;
      }
      case ChatMessageEventTypeEnum.ON_MESSAGE_START: {
        const message: Message = {
          id: meta.id ?? createMessageId(),
          type: meta.type ?? 'ai',
          content: meta.content ?? '',
        };
        setValues((prev) => {
          const messages = prev.messages ?? [];
          const last = messages[messages.length - 1];
          if (
            last &&
            isAssistantMessage(last) &&
            typeof last.content === 'string' &&
            last.content.length === 0
          ) {
            const nextMessages = [...messages];
            nextMessages[messages.length - 1] = message;
            return { ...prev, messages: nextMessages };
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

  const client = useMemo(
    () => new Client<StateType>({ apiUrl, apiKey }),
    [apiKey, apiUrl],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const submit = useCallback(
    async (
      input?: Record<string, unknown> | null,
      options?: StreamSubmitOptions,
    ) => {
      setError(null);
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
          applyStreamEvent(chunk as StreamChunk, setValues, setError);
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
    [assistantId, client, setThreadId, threadId],
  );

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
