import type { PropType } from 'vue';
import { defineComponent, h, onBeforeUnmount, shallowRef, watch } from 'vue';
import type {
  ChatKitEvents,
  ChatKitOptions,
  XpertAIChatKit,
} from '@xpert-ai/chatkit-types';
import '@xpert-ai/chatkit-web-component';
import type { ChatKitControl, ToEventHandlerKey } from './useChatKit.js';

type ListenerCleanup = (() => void) | undefined;

const EVENT_HANDLER_MAP: {
  [K in keyof ChatKitEvents]: ToEventHandlerKey<K>;
} = {
  'chatkit.error': 'onError',
  'chatkit.response.end': 'onResponseEnd',
  'chatkit.response.start': 'onResponseStart',
  'chatkit.log': 'onLog',
  'chatkit.thread.change': 'onThreadChange',
  'chatkit.project.change': 'onProjectChange',
  'chatkit.connectors.change': 'onConnectorsChange',
  'chatkit.thread.load.start': 'onThreadLoadStart',
  'chatkit.thread.load.end': 'onThreadLoadEnd',
  'chatkit.ready': 'onReady',
  'chatkit.effect': 'onEffect',
};

const EVENT_NAMES = Object.keys(EVENT_HANDLER_MAP) as (keyof ChatKitEvents)[];

function applyOptions(
  el: XpertAIChatKit,
  options: ChatKitOptions,
  isCurrent: () => boolean,
): ListenerCleanup {
  if (typeof customElements === 'undefined') {
    if (typeof (el as any).setOptions === 'function') {
      el.setOptions(options);
    }
    return;
  }

  if (customElements.get('xpertai-chatkit')) {
    el.setOptions(options);
    return;
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

export const ChatKit = defineComponent({
  name: 'ChatKit',
  inheritAttrs: false,
  props: {
    control: {
      type: Object as PropType<ChatKitControl>,
      required: true,
    },
  },
  setup(props, { attrs }) {
    const elRef = shallowRef<XpertAIChatKit | null>(null);
    let optionsCleanup: ListenerCleanup;
    let controller: AbortController | null = null;

    watch(
      () => elRef.value,
      (el) => {
        props.control.setInstance(el ?? null);
      },
      { immediate: true },
    );

    watch(
      [() => elRef.value, () => props.control.options],
      ([el, options]) => {
        if (optionsCleanup) {
          optionsCleanup();
          optionsCleanup = undefined;
        }

        if (!el) return;

        optionsCleanup = applyOptions(el, options, () => elRef.value === el);
      },
      { immediate: true, deep: true },
    );

    watch(
      [() => elRef.value, () => props.control.handlers],
      ([el, handlers]) => {
        if (controller) {
          controller.abort();
          controller = null;
        }

        if (!el) return;

        controller = new AbortController();
        for (const eventName of EVENT_NAMES) {
          el.addEventListener(
            eventName,
            (e) => {
              const handlerName = EVENT_HANDLER_MAP[eventName];
              const handler = handlers[handlerName];
              if (typeof handler === 'function') {
                handler((e as CustomEvent).detail as any);
              }
            },
            { signal: controller.signal },
          );
        }
      },
      { immediate: true, deep: true },
    );

    onBeforeUnmount(() => {
      if (optionsCleanup) {
        optionsCleanup();
        optionsCleanup = undefined;
      }
      if (controller) {
        controller.abort();
        controller = null;
      }
      props.control.setInstance(null);
    });

    return () => h('xpertai-chatkit', { ref: elRef, ...attrs });
  },
});
