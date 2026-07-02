import type { Ref, ShallowRef } from 'vue';
import { reactive, shallowRef, unref, watch } from 'vue';
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

export type ToEventHandlerKey<K extends keyof ChatKitEvents> =
  DotToCamelCase<K> extends `chatkit${infer EventName}`
    ? `on${Capitalize<EventName>}`
    : never;

type ChatKitEventHandlers = Partial<{
  [K in keyof ChatKitEvents as ToEventHandlerKey<K>]: ChatKitEvents[K] extends CustomEvent<
    infer Detail
  >
    ? Detail extends undefined
      ? () => void
      : (event: Detail) => void
    : never;
}>;

export type UseChatKitOptions = ChatKitOptions & ChatKitEventHandlers;

export type ChatKitControl = {
  setInstance: (instance: XpertAIChatKit | null) => void;
  options: ChatKitOptions;
  handlers: ChatKitEventHandlers;
};

export type UseChatKitReturn = ChatKitMethods & {
  control: ChatKitControl;
  ref: ShallowRef<XpertAIChatKit | null>;
};

export type MaybeRef<T> = T | Ref<T>;

function splitOptions(value: UseChatKitOptions): {
  options: ChatKitOptions;
  handlers: ChatKitEventHandlers;
} {
  const options = {} as ChatKitOptions;
  const handlers: ChatKitEventHandlers = {};

  for (const [key, entry] of Object.entries(value)) {
    if (/^on[A-Z]/.test(key) && key !== 'onClientTool') {
      (handlers as any)[key] = entry;
    } else {
      (options as any)[key] = entry;
    }
  }

  return { options, handlers };
}

export function useChatKit(options: MaybeRef<UseChatKitOptions>): UseChatKitReturn {
  const ref = shallowRef<XpertAIChatKit | null>(null);

  const setInstance = (instance: XpertAIChatKit | null): void => {
    ref.value = instance;
  };

  const control = reactive({
    setInstance,
    options: {} as ChatKitOptions,
    handlers: {} as ChatKitEventHandlers,
  });

  const methods = {} as ChatKitMethods;
  for (const key of CHATKIT_METHOD_NAMES) {
    methods[key] = (...args: any[]) => {
      if (!ref.value) {
        console.warn('ChatKit element is not mounted');
        return;
      }

      return (ref.value as any)[key](...args);
    };
  }

  watch(
    () => unref(options),
    (value) => {
      const next = splitOptions(value ?? ({} as UseChatKitOptions));
      control.options = next.options;
      control.handlers = next.handlers;
    },
    { immediate: true, deep: true },
  );

  return {
    ...methods,
    control,
    ref,
  };
}
