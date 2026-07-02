import type { ChatKitEvents, ChatKitOptions, XpertAIChatKit } from '@xpert-ai/chatkit-types';

type DotToCamelCase<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? `${Head}${Capitalize<DotToCamelCase<Tail>>}`
  : S;

const CHATKIT_METHOD_NAMES = Object.freeze([
  'focusComposer',
  'setThreadId',
  'sendUserMessage',
  'setComposerValue',
  'setRuntimeCapabilities',
  'fetchUpdates',
  'sendCustomAction',
] as const);

type ChatKitMethod = (typeof CHATKIT_METHOD_NAMES)[number];

type ChatKitMethods = {
  [K in ChatKitMethod]: XpertAIChatKit[K];
};

type ControlListener = () => void;

const EXCLUDED_HANDLER_KEYS = new Set(['onClientTool']);

export type ToEventHandlerKey<K extends keyof ChatKitEvents> = K extends string
  ? DotToCamelCase<K> extends `chatkit${infer EventName}`
    ? `on${Capitalize<EventName>}`
    : never
  : never;

export type ChatKitEventHandlers = Partial<{
  [K in keyof ChatKitEvents as ToEventHandlerKey<K>]: ChatKitEvents[K] extends CustomEvent<
    infer Detail
  >
    ? Detail extends undefined
      ? () => void
      : (event: Detail) => void
    : never;
}>;

export type CreateChatKitOptions = ChatKitOptions & ChatKitEventHandlers;

export type ChatKitControl = ChatKitMethods & {
  readonly element: XpertAIChatKit | null;
  setOptions: (next: CreateChatKitOptions) => void;
};

type InternalChatKitControl = ChatKitControl & {
  setInstance: (instance: XpertAIChatKit | null) => void;
  subscribe: (listener: ControlListener) => () => void;
  getOptions: () => ChatKitOptions;
  getHandlers: () => ChatKitEventHandlers;
};

function splitOptions(value: CreateChatKitOptions | undefined): {
  options: ChatKitOptions;
  handlers: ChatKitEventHandlers;
} {
  const options = {} as ChatKitOptions;
  const handlers: ChatKitEventHandlers = {};

  if (!value) {
    return { options, handlers };
  }

  for (const [key, entry] of Object.entries(value)) {
    if (/^on[A-Z]/.test(key) && !EXCLUDED_HANDLER_KEYS.has(key)) {
      const handlerKey = key as keyof ChatKitEventHandlers;
      if (typeof entry === 'function') {
        Object.assign(handlers, { [handlerKey]: entry });
      }
    } else {
      (options as Record<string, unknown>)[key] = entry;
    }
  }

  return { options, handlers };
}

function warnUnmounted(): void {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn('ChatKit element is not mounted');
  }
}

class ChatKitController {
  private instance: XpertAIChatKit | null = null;
  private options: ChatKitOptions = {} as ChatKitOptions;
  private handlers: ChatKitEventHandlers = {};
  private readonly listeners = new Set<ControlListener>();

  constructor(initialOptions: CreateChatKitOptions) {
    this.setOptions(initialOptions);
  }

  get element(): XpertAIChatKit | null {
    return this.instance;
  }

  setOptions(next: CreateChatKitOptions): void {
    const state = splitOptions(next);
    this.options = state.options;
    this.handlers = state.handlers;
    this.emit();
  }

  setInstance(instance: XpertAIChatKit | null): void {
    this.instance = instance;
  }

  subscribe(listener: ControlListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getOptions(): ChatKitOptions {
    return this.options;
  }

  getHandlers(): ChatKitEventHandlers {
    return this.handlers;
  }

  focusComposer(...args: Parameters<XpertAIChatKit['focusComposer']>) {
    return this.callMethod('focusComposer', ...args);
  }

  setThreadId(...args: Parameters<XpertAIChatKit['setThreadId']>) {
    return this.callMethod('setThreadId', ...args);
  }

  sendUserMessage(...args: Parameters<XpertAIChatKit['sendUserMessage']>) {
    return this.callMethod('sendUserMessage', ...args);
  }

  setComposerValue(...args: Parameters<XpertAIChatKit['setComposerValue']>) {
    return this.callMethod('setComposerValue', ...args);
  }

  setRuntimeCapabilities(
    ...args: Parameters<XpertAIChatKit['setRuntimeCapabilities']>
  ) {
    return this.callMethod('setRuntimeCapabilities', ...args);
  }

  fetchUpdates(...args: Parameters<XpertAIChatKit['fetchUpdates']>) {
    return this.callMethod('fetchUpdates', ...args);
  }

  sendCustomAction(...args: Parameters<XpertAIChatKit['sendCustomAction']>) {
    return this.callMethod('sendCustomAction', ...args);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private callMethod<K extends ChatKitMethod>(
    method: K,
    ...args: Parameters<ChatKitMethods[K]>
  ): ReturnType<ChatKitMethods[K]> | undefined {
    const methodRef = this.instance?.[method];
    if (!this.instance || typeof methodRef !== 'function') {
      warnUnmounted();
      return undefined;
    }

    return (methodRef as (...args: unknown[]) => unknown).apply(
      this.instance,
      args,
    ) as ReturnType<ChatKitMethods[K]>;
  }
}

export function createChatKit(options: CreateChatKitOptions): ChatKitControl {
  return new ChatKitController(options) as ChatKitControl;
}
