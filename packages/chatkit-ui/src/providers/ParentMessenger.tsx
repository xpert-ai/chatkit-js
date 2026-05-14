import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  STATE_VARIABLE_HUMAN,
  type ChatKitOptions,
  type ChatKitPetAnimationName,
  type ChatKitReferenceCompositionMode,
  type FollowUpBehavior,
  type SendUserMessageParams,
} from '@xpert-ai/chatkit-types';
import type { Capability } from '@xpert-ai/chatkit-web-shared';
import type { Message } from '@xpert-ai/xpert-sdk';
import { useStreamManager } from '../hooks/useStream';
import { buildInjectedRequestOptions } from '../lib/request-options';
import { isRuntimeCapabilitiesSelection } from '../lib/message-metadata';
import {
  buildHumanMessageInputPayload,
  type ComposerValuePayload,
  normalizeReferences,
} from '../lib/references';
import type { RuntimeCapabilitiesSelection } from '../lib/runtime-capabilities';
import { createMessageId } from '../lib/utils';

type CommandMessageMap = {
  onSendUserMessage: SendUserMessageParams;
  onSetComposerValue: ComposerValuePayload | null;
  onSetOptions: ChatKitOptions | null;
  onSetPetEnabled: { enabled: boolean };
  onFocusComposer: null;
  onSetThreadId: { threadId: string | null };
  onClientToolCall: unknown;
  onGetClientSecret: string | null;
  onWidgetAction: {
    action:
      | string
      | {
          type: string;
          payload?: Record<string, unknown>;
        };
    widgetItem: unknown;
  };
};

type ParentCommandMessage<
  K extends keyof CommandMessageMap = keyof CommandMessageMap,
> = {
  type: 'command';
  nonce: string;
  command: K;
  data: CommandMessageMap[K];
};

type ParentResponseMessage = {
  type: 'response';
  nonce: string;
  response?: unknown;
  error?: unknown;
};

type ParentEventPayloadMap = {
  public_event: [Capability.Event, unknown];
  chat_minimize_change: { minimized: boolean };
  pet_options_change: { pet: ChatKitOptions['pet'] | null };
  pet_state_change: { state: ChatKitPetAnimationName };
};

type ParentEventName = keyof ParentEventPayloadMap;

type ParentEventMessage<K extends ParentEventName = ParentEventName> = {
  type: 'event';
  event: K;
  data: ParentEventPayloadMap[K];
};

type ParentMessage =
  | ParentCommandMessage
  | ParentResponseMessage
  | ParentEventMessage;

type ParentEnvelope = Partial<ParentMessage> & { __xpaiChatKit: true };

const handledSendUserMessageNonces = new Set<string>();
const handledSendUserMessageEvents = new WeakSet<MessageEvent>();

const getParentOrigin = () => {
  if (typeof document === 'undefined' || !document.referrer) return '*';
  try {
    return new URL(document.referrer).origin;
  } catch {
    return '*';
  }
};

const createNonce = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ck_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export type ParentMessenger = {
  isParentAvailable: boolean;
  sendCommand: <C extends keyof CommandMessageMap>(
    command: C,
    data?: CommandMessageMap[C],
    transfer?: Transferable[],
  ) => Promise<unknown>;
  sendEvent: <E extends ParentEventName>(
    event: E,
    data: ParentEventPayloadMap[E],
    transfer?: Transferable[],
  ) => void;
};

type OnSetOptionsHandler = (options: ChatKitOptions | null) => void;
type OnSetPetEnabledHandler = (enabled: boolean) => void;
type OnSetComposerValueHandler = (
  payload: ComposerValuePayload | null,
) => void | Promise<void>;
type OnFocusComposerHandler = () => void | Promise<void>;

type ParentMessengerContextValue = ParentMessenger & {
  registerOnSetOptions: (handler: OnSetOptionsHandler) => () => void;
  registerOnSetPetEnabled: (handler: OnSetPetEnabledHandler) => () => void;
  registerOnSetComposerValue: (
    handler: OnSetComposerValueHandler,
  ) => () => void;
  registerOnFocusComposer: (handler: OnFocusComposerHandler) => () => void;
};

export const ParentMessengerContext =
  createContext<ParentMessengerContextValue | null>(null);

export type ParentMessengerProviderProps = {
  children: ReactNode;
};

export function ParentMessengerProvider({
  children,
}: ParentMessengerProviderProps) {
  const { streamRef } = useStreamManager();
  const parentOriginRef = useRef<string>('*');
  const pendingRef = useRef(
    new Map<
      string,
      { resolve: (value: unknown) => void; reject: (error: unknown) => void }
    >(),
  );
  const onSetOptionsHandlersRef = useRef(new Set<OnSetOptionsHandler>());
  const onSetPetEnabledHandlersRef = useRef(new Set<OnSetPetEnabledHandler>());
  const onSetComposerValueHandlersRef = useRef(
    new Set<OnSetComposerValueHandler>(),
  );
  const onFocusComposerHandlersRef = useRef(new Set<OnFocusComposerHandler>());
  const latestOptionsRef = useRef<ChatKitOptions | null>(null);

  const isParentAvailable = useMemo(() => {
    return typeof window !== 'undefined' && window.parent !== window;
  }, []);

  useEffect(() => {
    parentOriginRef.current = getParentOrigin();
  }, []);

  const registerOnSetOptions = useCallback((handler: OnSetOptionsHandler) => {
    onSetOptionsHandlersRef.current.add(handler);
    return () => {
      onSetOptionsHandlersRef.current.delete(handler);
    };
  }, []);

  const registerOnSetPetEnabled = useCallback(
    (handler: OnSetPetEnabledHandler) => {
      onSetPetEnabledHandlersRef.current.add(handler);
      return () => {
        onSetPetEnabledHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerOnSetComposerValue = useCallback(
    (handler: OnSetComposerValueHandler) => {
      onSetComposerValueHandlersRef.current.add(handler);
      return () => {
        onSetComposerValueHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  const registerOnFocusComposer = useCallback(
    (handler: OnFocusComposerHandler) => {
      onFocusComposerHandlersRef.current.add(handler);
      return () => {
        onFocusComposerHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  useEffect(() => {
    if (!isParentAvailable) return;

    const sendResponse = (
      nonce: string,
      response?: unknown,
      error?: unknown,
    ) => {
      const message: ParentEnvelope = {
        __xpaiChatKit: true,
        type: 'response',
        nonce,
        response,
        error,
      };
      window.parent.postMessage(message, parentOriginRef.current);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (
        parentOriginRef.current !== '*' &&
        typeof event.origin === 'string' &&
        event.origin !== parentOriginRef.current
      ) {
        return;
      }

      const payload = event.data as Partial<ParentEnvelope>;
      if (payload.__xpaiChatKit !== true) return;

      if (
        payload.type === 'command' &&
        payload.command === 'onSendUserMessage'
      ) {
        const nonce = typeof payload.nonce === 'string' ? payload.nonce : null;
        if (nonce) {
          if (handledSendUserMessageNonces.has(nonce)) return;
          handledSendUserMessageNonces.add(nonce);
        } else {
          if (handledSendUserMessageEvents.has(event)) return;
          handledSendUserMessageEvents.add(event);
        }

        const params = payload.data as SendUserMessageParams;
        const prompt =
          typeof params.text === 'string'
            ? params.text.trim()
            : typeof params.state?.[STATE_VARIABLE_HUMAN]?.input === 'string'
              ? params.state[STATE_VARIABLE_HUMAN].input.trim()
              : '';
        const references = normalizeReferences(
          params.references ?? params.state?.[STATE_VARIABLE_HUMAN]?.references,
        );
        const referenceComposition =
          params.referenceComposition ??
          (params.state?.[STATE_VARIABLE_HUMAN]?.referenceComposition as
            | ChatKitReferenceCompositionMode
            | undefined);
        const humanInput = buildHumanMessageInputPayload({
          content: prompt,
          references,
          referenceComposition,
        });

        if (!humanInput) {
          if (payload.nonce) {
            sendResponse(payload.nonce, { ok: true });
          }
          return;
        }
        const runtimeCapabilitiesCandidate =
          params.runtimeCapabilities ??
          params.state?.[STATE_VARIABLE_HUMAN]?.runtimeCapabilities;
        const runtimeCapabilities = isRuntimeCapabilitiesSelection(
          runtimeCapabilitiesCandidate,
        )
          ? runtimeCapabilitiesCandidate
          : undefined;
        const requestHumanInput =
          params.planMode === true ||
          params.state?.[STATE_VARIABLE_HUMAN]?.planMode === true ||
          runtimeCapabilities
            ? {
                ...humanInput,
                ...(params.planMode === true ||
                params.state?.[STATE_VARIABLE_HUMAN]?.planMode === true
                  ? { planMode: true }
                  : {}),
                ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
              }
            : humanInput;

        const newMessage: Message & {
          references?: typeof references;
          submittedInput?: string;
          referenceComposition?: ChatKitReferenceCompositionMode;
          followUpMode?: FollowUpBehavior;
          runtimeCapabilities?: RuntimeCapabilitiesSelection;
        } = {
          id: createMessageId(),
          type: 'human',
          content: prompt,
          submittedInput: humanInput.input,
          ...(humanInput.referenceComposition
            ? { referenceComposition: humanInput.referenceComposition }
            : {}),
          ...(references.length > 0 ? { references } : {}),
          ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
        };
        const stream = streamRef.current;
        const activeFollowUpMode = stream?.isLoading
          ? params.followUpMode && params.followUpMode !== 'default'
            ? params.followUpMode
            : (stream.followUpBehavior ?? 'queue')
          : undefined;
        const requestOptions = buildInjectedRequestOptions({
          defaults: latestOptionsRef.current?.request,
          state: params.state,
          humanInput: requestHumanInput,
        });

        stream?.submit(
          {
            input: requestHumanInput,
            ...(requestOptions.state ? { state: requestOptions.state } : {}),
          },
          {
            newThread: params.newThread,
            ...(activeFollowUpMode ? { followUpMode: activeFollowUpMode } : {}),
            ...(requestOptions.context
              ? { context: requestOptions.context }
              : {}),
            ...(requestOptions.config ? { config: requestOptions.config } : {}),
            ...(!activeFollowUpMode
              ? {
                  optimisticValues: (prev) => {
                    const prevMessages = prev?.messages ?? [];
                    return { ...prev, messages: [...prevMessages, newMessage] };
                  },
                }
              : {}),
          },
        );
        if (payload.nonce) {
          sendResponse(payload.nonce, { ok: true });
        }
        return;
      }

      if (
        payload.type === 'command' &&
        payload.command === 'onSetComposerValue'
      ) {
        const nextPayload =
          (payload.data as ComposerValuePayload | null) ?? null;
        const normalizedPayload =
          nextPayload && Array.isArray(nextPayload.references)
            ? {
                ...nextPayload,
                references: normalizeReferences(nextPayload.references),
              }
            : nextPayload;

        void Promise.all(
          [...onSetComposerValueHandlersRef.current].map((handler) =>
            Promise.resolve(handler(normalizedPayload)),
          ),
        )
          .then(() => {
            if (payload.nonce) {
              sendResponse(payload.nonce, { ok: true });
            }
          })
          .catch((error) => {
            if (payload.nonce) {
              sendResponse(payload.nonce, undefined, error);
            }
          });
        return;
      }

      if (payload.type === 'command' && payload.command === 'onSetOptions') {
        latestOptionsRef.current =
          (payload.data as ChatKitOptions | null) ?? null;
        if (onSetOptionsHandlersRef.current.size > 0) {
          onSetOptionsHandlersRef.current.forEach((handler) => {
            handler(payload.data as ChatKitOptions | null);
          });
        }
        if (payload.nonce) {
          sendResponse(payload.nonce, { ok: true });
        }
        return;
      }

      if (payload.type === 'command' && payload.command === 'onSetPetEnabled') {
        const data = payload.data as { enabled?: unknown } | null | undefined;
        const enabled = data?.enabled === true;
        onSetPetEnabledHandlersRef.current.forEach((handler) => {
          handler(enabled);
        });
        if (payload.nonce) {
          sendResponse(payload.nonce, { ok: true });
        }
        return;
      }

      if (payload.type === 'command' && payload.command === 'onFocusComposer') {
        void Promise.all(
          [...onFocusComposerHandlersRef.current].map((handler) =>
            Promise.resolve(handler()),
          ),
        )
          .then(() => {
            if (payload.nonce) {
              sendResponse(payload.nonce, { ok: true });
            }
          })
          .catch((error) => {
            if (payload.nonce) {
              sendResponse(payload.nonce, undefined, error);
            }
          });
        return;
      }

      if (payload.type === 'command' && payload.command === 'onSetThreadId') {
        const data = payload.data as
          | { threadId: string | null }
          | null
          | undefined;
        const nextThreadId = data?.threadId ?? null;
        const stream = streamRef.current;
        if (stream?.threadId === nextThreadId) {
          if (payload.nonce) {
            sendResponse(payload.nonce, { ok: true });
          }
          return;
        }
        stream?.reset(nextThreadId, undefined, { suppressThreadChange: true });
        if (stream && nextThreadId) {
          stream.loadThread(nextThreadId).catch((err) => {
            console.warn('Failed to load thread messages', err);
          });
        }
        if (payload.nonce) {
          sendResponse(payload.nonce, { ok: true });
        }
        return;
      }

      if (payload.type !== 'response') return;
      if (typeof payload.nonce !== 'string') return;
      const handler = pendingRef.current.get(payload.nonce);
      if (!handler) return;

      if (payload.error !== undefined) {
        handler.reject(payload.error);
      } else {
        handler.resolve(payload.response);
      }
      pendingRef.current.delete(payload.nonce);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      pendingRef.current.forEach((handler) => {
        handler.reject(new Error('Parent messenger closed'));
      });
      pendingRef.current.clear();
    };
  }, [isParentAvailable, streamRef]);

  const sendCommand = useCallback(
    <K extends keyof CommandMessageMap>(
      command: K,
      data?: CommandMessageMap[K],
      transfer?: Transferable[],
    ) => {
      if (!isParentAvailable) {
        return Promise.reject(new Error('Parent window not available'));
      }

      const nonce = createNonce();
      const message: ParentEnvelope = {
        __xpaiChatKit: true,
        type: 'command',
        nonce,
        command,
        data: data ?? null,
      };

      return new Promise<unknown>((resolve, reject) => {
        pendingRef.current.set(nonce, { resolve, reject });
        window.parent.postMessage(message, parentOriginRef.current, transfer);
      });
    },
    [isParentAvailable],
  );

  const sendEvent = useCallback(
    <E extends ParentEventName>(
      event: E,
      data: ParentEventPayloadMap[E],
      transfer?: Transferable[],
    ) => {
      if (!isParentAvailable) return;
      const message: ParentEnvelope = {
        __xpaiChatKit: true,
        type: 'event',
        event,
        data,
      };
      window.parent.postMessage(message, parentOriginRef.current, transfer);
    },
    [isParentAvailable],
  );

  const value = useMemo(
    () => ({
      isParentAvailable,
      sendCommand,
      sendEvent,
      registerOnSetOptions,
      registerOnSetPetEnabled,
      registerOnSetComposerValue,
      registerOnFocusComposer,
    }),
    [
      isParentAvailable,
      sendCommand,
      sendEvent,
      registerOnSetOptions,
      registerOnSetPetEnabled,
      registerOnSetComposerValue,
      registerOnFocusComposer,
    ],
  );

  return (
    <ParentMessengerContext.Provider value={value}>
      {children}
    </ParentMessengerContext.Provider>
  );
}
