import * as React from 'react';
import { XpertAIChatKit, ChatKitEvents, ChatKitOptions } from '@xpert-ai/chatkit-types';

// Import web component side effect
import { registerChatKitElement } from '@xpert-ai/chatkit-web-component';
import { ChatKitControl, ToEventHandlerKey } from './useChatKit';

registerChatKitElement()

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'xpertai-chatkit': React.DetailedHTMLProps<
        React.HTMLAttributes<XpertAIChatKit>,
        XpertAIChatKit
      >;
    }
  }
}

export interface ChatKitProps extends React.HTMLAttributes<XpertAIChatKit> {
  control: ChatKitControl;
}

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

const defaultFetch: typeof fetch = (input, init) => fetch(input, init);

const placeholderOptions: ChatKitOptions = {
  api: {
    fetch: defaultFetch,
    getClientSecret: async () => {
      console.warn('[XpertChatKit] Missing options.api.getClientSecret; using placeholder.');
      return '';
    },
    addMetadataToRequest: async () => ({} as RequestInit),
  },
  onClientTool: async () => {
    console.warn('[XpertChatKit] Missing options.onClientTool; using placeholder.');
    return null;
  },
};

export const ChatKit = React.forwardRef<XpertAIChatKit, ChatKitProps>(
  function ChatKit({ control, ...htmlProps }, forwardedRef) {
    const ref = React.useRef<XpertAIChatKit | null>(null);

    React.useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;

      // Fast path: element is already defined
      if (customElements.get('xpertai-chatkit')) {
        el.setOptions(control.options);
        return;
      }
      // Fallback path: wait for definition
      let active = true;
      customElements.whenDefined('xpertai-chatkit').then(() => {
        if (active) {
          el.setOptions(control.options);
        }
      });
      return () => {
        active = false;
      };
    }, [control.options]);

    React.useEffect(() => {
      const el = ref.current;
      if (!el) return;

      const controller = new AbortController();
      for (const eventName of EVENT_NAMES) {
        el.addEventListener(
          eventName,
          (e) => {
            const handlerName = EVENT_HANDLER_MAP[eventName];
            const handler = control.handlers[handlerName];
            if (typeof handler === 'function') {
              handler(e.detail as any);
            }
          },
          { signal: controller.signal },
        );
      }
      return () => {
        controller.abort();
      };
    }, [control.handlers]);

    return (
      <xpertai-chatkit
        ref={(chatKit) => {
          ref.current = chatKit;

          control.setInstance(chatKit);

          if (typeof forwardedRef === 'function') {
            forwardedRef(chatKit);
          } else if (forwardedRef) {
            forwardedRef.current = chatKit;
          }

          if (!ref.current) {
            return;
          }
        }}
        {...htmlProps}
      />
    );
  },
);
