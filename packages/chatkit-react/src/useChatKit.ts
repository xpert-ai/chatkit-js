import * as React from 'react';
import type {
  ChatKitOptions,
} from './types';
import { ChatKitEvents, XpertAIChatKit } from '@xpert-ai/chatkit-types';
import { useStableOptions } from './useStableOptions';

/**
 * Encode options to base64 for URL
 */
function encodeOptionsToBase64(options: Record<string, unknown>): string {
  const json = JSON.stringify(options);
  // Use btoa for browser, handle unicode characters
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return encoded;
}

/**
 * Build the full chatkit URL with options encoded
 */
function buildChatKitUrl(baseUrl: string, options?: Record<string, unknown>): string {
  if (!options || Object.keys(options).length === 0) {
    return baseUrl;
  }

  const encoded = encodeOptionsToBase64(options);
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}options=${encoded}`;
}

type DotToCamelCase<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? `${Head}${Capitalize<DotToCamelCase<Tail>>}`
  : S;

const CHATKIT_METHOD_NAMES = Object.freeze([
  'focusComposer',
  'setThreadId',
  'sendUserMessage',
  'setComposerValue',
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
  ref: React.RefObject<XpertAIChatKit | null>;
};


export function useChatKit(options: UseChatKitOptions): UseChatKitReturn {
  const ref = React.useRef<XpertAIChatKit | null>(null);
  const stableOptions = useStableOptions(options);

  const methods: ChatKitMethods = React.useMemo(() => {
    return CHATKIT_METHOD_NAMES.reduce((acc, key) => {
      acc[key] = (...args: any[]) => {
        if (!ref.current) {
          console.warn('ChatKit element is not mounted');
          return;
        }

        return (ref.current as any)[key](...args);
      };
      return acc;
    }, {} as ChatKitMethods);
  }, []);

  const setInstance = React.useCallback(
    (instance: XpertAIChatKit | null): void => {
      ref.current = instance;
    },
    [],
  );

  const control: ChatKitControl = React.useMemo(() => {
    const options = {} as ChatKitOptions;
    const handlers: ChatKitEventHandlers = {};

    for (const [key, value] of Object.entries(stableOptions)) {
      if (/^on[A-Z]/.test(key) && key !== 'onClientTool') {
        // @ts-expect-error - too dynamic for TypeScript
        handlers[key] = value;
      } else {
        // @ts-expect-error - too dynamic for TypeScript
        options[key] = value;
      }
    }

    return {
      setInstance,
      options,
      handlers,
    };
  }, [stableOptions, setInstance]);

  return React.useMemo(
    () => ({ ...methods, control, ref }),
    [methods, control],
  );
}