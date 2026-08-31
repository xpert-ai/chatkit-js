import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import type {
  ChatKitEvents,
  ChatKitOptions,
  XpertAIChatKit,
} from '@xpert-ai/chatkit-types';
import type { ChatKitControl, ToEventHandlerKey } from './control';

type ListenerCleanup = (() => void) | undefined;
type BoundChatKitControl = ChatKitControl & {
  setInstance: (instance: XpertAIChatKit | null) => void;
  subscribe: (listener: () => void) => () => void;
  getOptions: () => ChatKitOptions;
  getHandlers: () => Record<string, unknown>;
};

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

@Directive({
  selector: 'xpertai-chatkit',
  standalone: true,
  inputs: ['control'],
})
export class ChatKitElement implements OnDestroy {
  private readonly hostRef = inject(ElementRef<XpertAIChatKit>);
  private readonly element = this.hostRef.nativeElement;
  private currentControl: BoundChatKitControl | null = null;
  private optionsCleanup: ListenerCleanup;
  private handlersAbortController: AbortController | null = null;
  private controlCleanup: (() => void) | null = null;

  set control(value: ChatKitControl) {
    if (!value) {
      this.unbindCurrentControl();
      return;
    }

    this.bindControl(value as BoundChatKitControl);
  }

  ngOnDestroy(): void {
    this.unbindCurrentControl();
  }

  private bindControl(control: BoundChatKitControl): void {
    if (control === this.currentControl) {
      return;
    }

    this.unbindCurrentControl();
    this.currentControl = control;

    this.controlCleanup = control.subscribe(() => {
      this.syncControl();
    });

    this.syncControl();
  }

  private syncControl(): void {
    const control = this.currentControl;
    const element = this.element;
    if (!control || !element) {
      return;
    }

    control.setInstance(element);

    if (this.optionsCleanup) {
      this.optionsCleanup();
      this.optionsCleanup = undefined;
    }

    this.optionsCleanup = applyOptions(element, control.getOptions(), () => {
      return this.currentControl === control;
    });

    if (this.handlersAbortController) {
      this.handlersAbortController.abort();
      this.handlersAbortController = null;
    }

    const handlers = control.getHandlers();
    const controller = new AbortController();
    for (const eventName of EVENT_NAMES) {
      element.addEventListener(
        eventName,
        (event: Event) => {
          const handlerName = EVENT_HANDLER_MAP[eventName];
          const handler = handlers[handlerName];
          if (typeof handler === 'function') {
            handler((event as CustomEvent).detail as never);
          }
        },
        { signal: controller.signal },
      );
    }
    this.handlersAbortController = controller;
  }

  private unbindCurrentControl(): void {
    if (this.optionsCleanup) {
      this.optionsCleanup();
      this.optionsCleanup = undefined;
    }

    if (this.handlersAbortController) {
      this.handlersAbortController.abort();
      this.handlersAbortController = null;
    }

    if (this.controlCleanup) {
      this.controlCleanup();
      this.controlCleanup = null;
    }

    if (this.currentControl) {
      this.currentControl.setInstance(null);
      this.currentControl = null;
    }
  }
}
