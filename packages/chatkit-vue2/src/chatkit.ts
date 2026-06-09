import Vue from 'vue';
import type { CreateElement, VNode } from 'vue';
import type {
  ChatKitEvents,
  ChatKitOptions,
  XpertAIChatKit,
} from '@xpert-ai/chatkit-types';
import '@xpert-ai/chatkit-web-component';
import type {
  ChatKitControl,
  ChatKitEventHandlers,
  InternalChatKitControl,
  ToEventHandlerKey,
} from './control.js';

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

type ChatKitComponentInstance = Vue & {
  control: ChatKitControl;
  currentControl: InternalChatKitControl | null;
  optionsCleanup: ListenerCleanup;
  handlersCleanup: ListenerCleanup;
  controlCleanup: (() => void) | null;
  bindControl: (control: ChatKitControl | null) => void;
  syncControl: () => void;
  unbindCurrentControl: () => void;
};

function applyOptions(
  element: XpertAIChatKit,
  options: ChatKitOptions,
  isCurrent: () => boolean,
): ListenerCleanup {
  if (typeof customElements === 'undefined') {
    if (typeof element.setOptions === 'function') {
      element.setOptions(options);
    }
    return undefined;
  }

  if (customElements.get('xpertai-chatkit')) {
    element.setOptions(options);
    return undefined;
  }

  let active = true;
  customElements.whenDefined('xpertai-chatkit').then(() => {
    if (active && isCurrent()) {
      element.setOptions(options);
    }
  });

  return () => {
    active = false;
  };
}

function bindEventHandlers(
  element: XpertAIChatKit,
  handlers: ChatKitEventHandlers,
): ListenerCleanup {
  const cleanups: Array<() => void> = [];

  for (const eventName of EVENT_NAMES) {
    const listener = (event: Event) => {
      const handlerName = EVENT_HANDLER_MAP[eventName];
      const handler = handlers[handlerName];
      if (typeof handler === 'function') {
        handler((event as CustomEvent).detail as never);
      }
    };

    element.addEventListener(eventName, listener);
    cleanups.push(() => {
      element.removeEventListener(eventName, listener);
    });
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

export const ChatKit = Vue.extend({
  name: 'ChatKit',
  inheritAttrs: false,
  props: {
    control: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      currentControl: null as InternalChatKitControl | null,
      optionsCleanup: undefined as ListenerCleanup,
      handlersCleanup: undefined as ListenerCleanup,
      controlCleanup: null as (() => void) | null,
    };
  },
  watch: {
    control(this: ChatKitComponentInstance, value: ChatKitControl | null) {
      this.bindControl(value);
    },
  },
  mounted(this: ChatKitComponentInstance) {
    this.bindControl(this.control);
  },
  beforeDestroy(this: ChatKitComponentInstance) {
    this.unbindCurrentControl();
  },
  methods: {
    bindControl(
      this: ChatKitComponentInstance,
      control: ChatKitControl | null,
    ): void {
      if (!control) {
        this.unbindCurrentControl();
        return;
      }

      const nextControl = control as InternalChatKitControl;
      if (nextControl === this.currentControl) {
        return;
      }

      this.unbindCurrentControl();
      this.currentControl = nextControl;
      this.controlCleanup = nextControl.subscribe(() => {
        this.syncControl();
      });
      this.syncControl();
    },

    syncControl(this: ChatKitComponentInstance): void {
      const control = this.currentControl;
      const element = this.$refs.chatkit as XpertAIChatKit | undefined;

      if (!control || !element) {
        return;
      }

      control.setInstance(element);

      if (this.optionsCleanup) {
        this.optionsCleanup();
        this.optionsCleanup = undefined;
      }

      this.optionsCleanup = applyOptions(element, control.getOptions(), () => {
        return (
          this.currentControl === control && this.$refs.chatkit === element
        );
      });

      if (this.handlersCleanup) {
        this.handlersCleanup();
        this.handlersCleanup = undefined;
      }

      this.handlersCleanup = bindEventHandlers(element, control.getHandlers());
    },

    unbindCurrentControl(this: ChatKitComponentInstance): void {
      if (this.optionsCleanup) {
        this.optionsCleanup();
        this.optionsCleanup = undefined;
      }

      if (this.handlersCleanup) {
        this.handlersCleanup();
        this.handlersCleanup = undefined;
      }

      if (this.controlCleanup) {
        this.controlCleanup();
        this.controlCleanup = null;
      }

      if (this.currentControl) {
        this.currentControl.setInstance(null);
        this.currentControl = null;
      }
    },
  },
  render(this: ChatKitComponentInstance, h: CreateElement): VNode {
    return h('xpertai-chatkit', {
      ref: 'chatkit',
      attrs: this.$attrs,
      on: this.$listeners,
    });
  },
});
