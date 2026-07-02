import type { ChatKitEvents, ChatKitOptions, XpertAIChatKit } from '@xpert-ai/chatkit-types';
import '@xpert-ai/chatkit-web-component';

type DotToCamelCase<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? `${Head}${Capitalize<DotToCamelCase<Tail>>}`
  : S;

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

export type CreateChatKitOptions = ChatKitOptions &
  ChatKitEventHandlers & {
    element?: XpertAIChatKit | string | null;
  };

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

type ListenerCleanup = (() => void) | undefined;

const EVENT_HANDLER_MAP: {
  [K in keyof ChatKitEvents]: ToEventHandlerKey<K>;
} = {
  'chatkit.error': 'onError',
  'chatkit.response.end': 'onResponseEnd',
  'chatkit.response.start': 'onResponseStart',
  'chatkit.log': 'onLog',
  'chatkit.thread.change': 'onThreadChange',
  'chatkit.thread.load.start': 'onThreadLoadStart',
  'chatkit.thread.load.end': 'onThreadLoadEnd',
  'chatkit.ready': 'onReady',
  'chatkit.effect': 'onEffect',
};

const EVENT_NAMES = Object.keys(EVENT_HANDLER_MAP) as (keyof ChatKitEvents)[];

const EXCLUDED_HANDLER_KEYS = new Set(['onClientTool']);

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
    } else if (key !== 'element') {
      (options as Record<string, unknown>)[key] = entry;
    }
  }

  return { options, handlers };
}

function resolveElement(element?: XpertAIChatKit | string | null): XpertAIChatKit {
  if (element) {
    if (typeof element === 'string') {
      if (typeof document !== 'undefined') {
        const resolved = document.querySelector(element);
        if (resolved) {
          return resolved as XpertAIChatKit;
        }
      }
    } else {
      return element;
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('ChatKit element cannot be created outside the browser');
  }

  return document.createElement('xpertai-chatkit') as XpertAIChatKit;
}

function applyOptions(
  el: XpertAIChatKit,
  options: ChatKitOptions,
  isCurrent: () => boolean,
): ListenerCleanup {
  if (typeof customElements === 'undefined') {
    if (typeof el.setOptions === 'function') {
      el.setOptions(options);
    }
    return undefined;
  }

  if (customElements.get('xpertai-chatkit')) {
    el.setOptions(options);
    return undefined;
  }

  let active = true;
  customElements.whenDefined('xpertai-chatkit').then(() => {
    if (active && isCurrent()) {
      el.setOptions(options);
    }
  });

  return () => {
    active = false;
  };
}

export type ChatKitInstance = ChatKitMethods & {
  element: XpertAIChatKit;
  destroy: () => void;
};

export function createChatKit(
  config: CreateChatKitOptions = {} as CreateChatKitOptions,
): ChatKitInstance {
  const element = resolveElement(config.element ?? null);
  const { options, handlers } = splitOptions(config);

  let active = true;
  const optionsCleanup = applyOptions(element, options, () => active);

  const controller = new AbortController();
  for (const eventName of EVENT_NAMES) {
    element.addEventListener(
      eventName,
      (event) => {
        const handlerName = EVENT_HANDLER_MAP[eventName];
        const handler = handlers[handlerName];
        if (typeof handler === 'function') {
          handler((event as CustomEvent).detail as any);
        }
      },
      { signal: controller.signal },
    );
  }

  const methods = {} as Record<ChatKitMethod, (...args: any[]) => unknown>;
  for (const key of CHATKIT_METHOD_NAMES) {
    methods[key] = (...args: any[]) => {
      const method = element[key];
      if (typeof method !== 'function') {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('ChatKit element is not mounted');
        }
        return;
      }

      return (method as (...args: unknown[]) => unknown).apply(element, args);
    };
  }

  const destroy = () => {
    active = false;
    controller.abort();
    if (optionsCleanup) {
      optionsCleanup();
    }
  };

  return {
    element,
    destroy,
    ...(methods as ChatKitMethods),
  };
}
