import type { ChatKitOptions } from "./options";

export type EventHandler<K extends keyof ChatKitEvents> = (
  event: ChatKitEvents[K],
) => any;

/**
 * strategies to host files before attaching them to messages.
 */

/**
 * Attachment associated with a user message. When passed to `sendUserMessage` or
 * `setComposerValue`, it must already be uploaded by your server. We do not currently
 * support attaching raw Files to a message.
 */
export type Attachment =
  | {
      type: 'file';
      /** Server-generated identifier for the uploaded file. */
      id: string;
      /** Original filename shown in the UI. */
      name: string;
      /** MIME type of the file. */
      mime_type: string;
    }
  | {
      type: 'image';
      /** Server-generated identifier for the uploaded image. */
      id: string;
      /** URL used to render the image preview in the UI. */
      preview_url: string;
      /** Original filename shown in the UI. */
      name: string;
      /** MIME type of the image. */
      mime_type: string;
    };

/**
 * A Web Component that serves as the entry point for a ChatKit integration.
 * * @noInheritDoc
 */
export interface XpertAIChatKit extends HTMLElement {
  /**
   * Applies configuration options to the ChatKit instance.
   *
   * **IMPORTANT**: New options are not merged with the existing options. You must provide a full set of options every time you call this method.
   */
  setOptions(options: ChatKitOptions): void;

  /** Focuses the composer input field. */
  focusComposer(): Promise<void>;

  /** Changes the active thread. Pass `null` to switch to a new thread. */
  setThreadId(threadId: string | null): Promise<void>;

  /**
   * Sends a custom application-defined action to your backend.
   */
  sendCustomAction(
    action: { type: string; payload?: Record<string, unknown> },
    /**
     * The ID of the WidgetItem that the action is associated with. You may
     * need this if the action was triggered by a widget, gets handled
     * client-side, and then you want to send the action back to the server to
     * do additional handling.
     *
     * @example
     * ```ts
     * chatKit.options = {
     *   // other options...
     *   widgets: {
     *     async onAction(action, widgetItem) {
     *       await someClientSideHandling(action)
     *       await chatkit.sendAction(action, widgetItem.id)
     *     }
     *   }
     * }
     * ```
     */
    itemId?: string,
  ): Promise<void>;

  /** Sends a user message. */
  sendUserMessage(params: {
    text: string;
    reply?: string;
    attachments?: Attachment[];
    newThread?: boolean;
  }): Promise<void>;

  /** Sets the composer's content without sending a message. */
  setComposerValue(params: {
    text: string;
    reply?: string;
    attachments?: Attachment[];
  }): Promise<void>;

  /**
   * Manually fetches updates from the server.
   *
   * Use this when you've manually updated the thread or thread items and need to sync them with the client.
   */
  fetchUpdates(): Promise<void>;

  /**
   * Adds an event listener for the specified {@link ChatKitEvents} event.
   *
   * @example
   * ```ts
   * chatKit.addEventListener('chatkit.error', (event) => {
   *   logToMyErrorLogger(event.detail.error);
   * });
   * ```
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener}
   */
  addEventListener<K extends keyof ChatKitEvents>(
    /**
     * See {@link ChatKitEvents} for available events.
     */
    type: K,
    /**
     * The event listener callback.
     */
    listener: EventHandler<K>,
    /**
     * An object that specifies characteristics about the event listener.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options}
     */
    options?: boolean | AddEventListenerOptions,
  ): void;

  /** @internal */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;

  /**
   * Removes an event listener for the specified event.
   *
   * @example
   * ```ts
   * chatKit.removeEventListener('chatkit.error', myErrorListener);
   * ```
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener}
   */
  removeEventListener<K extends keyof ChatKitEvents>(
    /**
     * See {@link ChatKitEvents} for available events.
     */
    type: K,
    /**
     * The event listener callback to remove.
     */
    listener: EventHandler<K>,
    /**
     * An object that specifies characteristics about the event listener.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener#options}
     */
    options?: boolean | EventListenerOptions,
  ): void;

  /** @internal */
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}

/**
 * DOM events emitted by the `xpertai-chatkit` custom element.
 */
export type ChatKitEvents = {
  /** Emitted when the ChatKit frame has loaded. */
  'chatkit.ready': CustomEvent<void>;

  /** Emitted when an error occurs. You should log these for monitoring and debugging. */
  'chatkit.error': CustomEvent<{ error: Error }>;

  /** Emitted when a fire-and-forget client effect is triggered. */
  'chatkit.effect': CustomEvent<{
    name: string;
    data?: Record<string, unknown>;
  }>;

  /** Emitted when the assistant begins sending a response. */
  'chatkit.response.start': CustomEvent<void>;

  /** Emitted when the assistant finishes sending a response. */
  'chatkit.response.end': CustomEvent<void>;

  /** Emitted when the active thread changes. Use this along with `initialThread` to persist the current thread across page loads or sessions. */
  'chatkit.thread.change': CustomEvent<{ threadId: string | null }>;

  /** Emitted when ChatKit starts loading a thread (initial load or selected from history). */
  'chatkit.thread.load.start': CustomEvent<{ threadId: string }>;

  /** Emitted when ChatKit finished loading a thread. */
  'chatkit.thread.load.end': CustomEvent<{ threadId: string }>;

  /** Diagnostic events that can be used for logging/analytics. */
  'chatkit.log': CustomEvent<{
    name: string;
    data?: Record<string, unknown>;
  }>;
};
