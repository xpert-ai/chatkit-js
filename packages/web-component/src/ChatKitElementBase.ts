/// <reference path="./import-meta-env.d.ts" />

import {
  createSecureChannelId,
  encodeBase64,
} from '@xpert-ai/chatkit-web-shared';

import { ChatFrameMessenger } from './ChatFrameMessenger';
import type {
  Card,
  ChatKitOptions,
  Entity,
  ListView,
  ToolOutputAttachmentPreviewRequest,
} from '@xpert-ai/chatkit-types';
import { normalizePetOptions } from '@xpert-ai/chatkit-types';
import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import type { RuntimeCapabilitiesSelection } from '@xpert-ai/chatkit-types';
import type { SendUserMessageParams } from '@xpert-ai/chatkit-types';
import { removeMethods } from './helpers';

import type {
  Attachment,
  ChatKitFrameParams,
  ChatKitProfile,
  ChatKitInnerOptions,
  ChatKitReq,
  UserMessageContent,
} from '@xpert-ai/chatkit-web-shared';
import { getCapabilities } from '@xpert-ai/chatkit-web-shared';
import type { Capabilities, Capability } from '@xpert-ai/chatkit-web-shared';
import {
  IntegrationError,
  fromPossibleFrameSafeError,
} from '@xpert-ai/chatkit-web-shared';
import {
  PetOverlay,
  parsePetOptionsChangePayload,
  parsePetStateChangePayload,
  parseThreadSummaryLogPayload,
  type ThreadSummary,
} from './PetOverlay';

// Compute inner options by removing methods (to make options serializable)
function getInnerOptions(options: ChatKitOptions): ChatKitInnerOptions {
  return removeMethods(options) as ChatKitInnerOptions;
}

// Decorator to assert that a command is available for the current capabilities profile
export function requireCommandCapability<
  This extends ChatKitElementBase<unknown>,
  Args extends unknown[],
  Return,
>(
  value: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >,
) {
  const command = String(context.name);
  return function (this: This, ...args: Args) {
    if (!this.capabilities.commands.has(command as Capability.Command)) {
      throw new IntegrationError(
        `ChatKit command "${String(command)}" is not available for the "${this.profile}" profile.`,
      );
    }
    return value.apply(this, args);
  };
}

interface ChatKitBaseElementEventMap {
  'chatkit.ready': CustomEvent<void>;
  'chatkit.error': CustomEvent<{ error: Error }>;
  'chatkit.response.start': CustomEvent<void>;
  'chatkit.response.end': CustomEvent<void>;
  'chatkit.thread.change': CustomEvent<{ threadId: string | null }>;
  'chatkit.log': CustomEvent<{ name: string; data?: Record<string, unknown> }>;
  'chatkit.deeplink': CustomEvent<{
    name: string;
    data?: Record<string, unknown>;
  }>;
  'chatkit.widget.action': CustomEvent<{
    action: string;
    payload?: Record<string, unknown>;
  }>;
}

export abstract class ChatKitElementBase<TRawOptions> extends HTMLElement {
  protected profile: ChatKitProfile;
  protected capabilities: Capabilities;
  protected abstract sanitizeOptions(options: TRawOptions): ChatKitOptions;

  #opts?: ChatKitOptions;
  #frameUrl?: string;
  #frame?: HTMLIFrameElement;
  #wrapper?: HTMLDivElement;
  #launcherCloseButton?: HTMLButtonElement;
  #launcherOpen = false;
  #chatMinimizedToPet = false;
  #framePetOptionsOverride: ChatKitOptions['pet'] | null | undefined;
  #petClosedByContextMenu = false;

  #shadow = this.attachShadow({ mode: 'open' });
  #petOverlay = new PetOverlay(this.#shadow, {
    onActivate: () => this.#handlePetActivate(),
    onClose: () => this.#handlePetClose(),
    onReply: (text) => this.#handlePetReply(text),
    onThreadSummaryActivate: (threadId) =>
      void this.#handlePetThreadSummaryActivate(threadId),
  });

  #resolveLoaded?: () => void;
  #loaded = new Promise<void>((resolve) => {
    this.#resolveLoaded = resolve;
  });
  #channelId = createSecureChannelId();

  #messenger = new ChatFrameMessenger({
    channelId: this.#channelId ?? undefined,
    fetch: ((...args) => {
      const customFetch =
        this.#opts?.api && 'fetch' in this.#opts.api && this.#opts.api.fetch;
      return customFetch ? customFetch(...args) : fetch(...args);
    }) as typeof fetch,
    target: () => this.#frame?.contentWindow ?? null,
    targetOrigin: window.location.origin,
    handlers: {
      onFileInputClick: ({
        inputAttributes,
      }: {
        inputAttributes: Record<string, string>;
      }) => {
        return new Promise<File[]>((resolve) => {
          const input = document.createElement('input');
          for (const [key, value] of Object.entries(inputAttributes)) {
            input.setAttribute(key, String(value));
          }
          const respond = () => {
            resolve(Array.from(input.files || []));
            if (this.#shadow.contains(input)) {
              this.#shadow.removeChild(input);
            }
          };
          input.addEventListener('cancel', respond);
          input.addEventListener('change', respond);
          this.#shadow.appendChild(input);
          input.click();
        });
      },
      onClientToolCall: async ({
        name,
        params,
        id,
        tool_call_id,
      }: {
        name: string;
        params: Record<string, unknown>;
        id?: string;
        tool_call_id?: string;
      }) => {
        const onClientTool = this.#opts?.onClientTool;
        if (!onClientTool) {
          this.#emitAndThrow(
            new IntegrationError(
              `No handler for client tool calls. You'll need to add onClientTool to your ChatKit options.`,
            ),
          );
        }
        return onClientTool({ name, params, id, tool_call_id });
      },
      onToolOutputAttachmentPreview: async (
        request: ToolOutputAttachmentPreviewRequest,
      ) => {
        const onRequestPreview =
          this.#opts?.toolOutputAttachments?.onRequestPreview;
        if (!onRequestPreview) {
          this.#emitAndThrow(
            new IntegrationError(
              'No handler for tool-output attachment previews. Add toolOutputAttachments.onRequestPreview to your ChatKit options.',
            ),
          );
        }
        return onRequestPreview(request);
      },
      onWorkbenchClientCommand: async ({
        commandKey,
        payload,
        hostType,
        hostId,
        viewKey,
      }: {
        commandKey: string;
        payload?: unknown;
        hostType: 'agent';
        hostId: string;
        viewKey: string;
      }) => {
        const onClientCommand = this.#opts?.workbench?.onClientCommand;
        if (!onClientCommand) {
          this.#emitAndThrow(
            new IntegrationError(
              `No handler for workbench client command "${commandKey}". Add workbench.onClientCommand to your ChatKit options.`,
            ),
          );
        }
        return onClientCommand({
          commandKey,
          payload,
          hostType,
          hostId,
          viewKey,
        });
      },
      onWidgetAction: async ({
        action,
        widgetItem,
      }: {
        action: {
          type: string;
          payload?: Record<string, unknown> | undefined;
        };
        widgetItem: {
          id: string;
          widget: Card | ListView;
        };
      }) => {
        const onAction = this.#opts?.widgets?.onAction;
        if (!onAction) {
          this.#emitAndThrow(
            new IntegrationError(
              `No handler for widget actions. You'll need to add widgets.onAction to your ChatKit options.`,
            ),
          );
        }
        return onAction(action, widgetItem);
      },
      onEntitySearch: async ({ query }: { query: string }) =>
        this.#opts?.entities?.onTagSearch?.(query) ?? [],
      onEntityClick: async ({ entity }: { entity: Entity }) =>
        this.#opts?.entities?.onClick?.(entity),
      onEntityPreview: async ({ entity }: { entity: Entity }) =>
        this.#opts?.entities?.onRequestPreview?.(entity) ?? { preview: null },
      onGetClientSecret: async (currentClientSecret: string | null) => {
        if (
          !this.#opts ||
          !('getClientSecret' in this.#opts.api) ||
          !this.#opts.api.getClientSecret
        ) {
          // ~Impossible since the existence of this handler is the only way
          // that we end up creating the kind of ApiClient that would call this handler in the first place.
          this.#emitAndThrow(
            new IntegrationError(
              'Could not refresh the session because ChatKitOptions.api.getClientSecret is not configured.',
            ),
          );
        }

        return this.#opts.api.getClientSecret(currentClientSecret ?? null);
      },
      onAddMetadataToRequest: ({
        op,
        params,
      }: {
        op: ChatKitReq['type'];
        params: Record<string, unknown>;
      }): void => {
        throw new IntegrationError(
          'ChatKit: onAddMetadataToRequest is unimplemented.',
        );
        // if (!this.#opts) return null
        // if (!("addMetadataToRequest" in this.#opts.api) || !this.#opts.api.addMetadataToRequest)
        //   return null

        // const result = this.#opts.api.addMetadataToRequest({ op, params })
        // if (!result) return null

        // return result.then((value) => {
        //   if (!value) return null
        //   if (typeof value !== "object" || Array.isArray(value)) {
        //     throw new IntegrationError(
        //       "ChatKit: addMetadataToRequest must return an object or null.",
        //     )
        //   }
        //   return value as Record<string, unknown>
        // })
      },
    },
  });

  constructor({ profile }: { profile: ChatKitProfile }) {
    super();
    this.profile = profile;
    this.capabilities = getCapabilities(profile);
  }

  protected setProfile(profile: ChatKitProfile) {
    this.profile = profile;
    this.capabilities = getCapabilities(profile);
  }

  #emitAndThrow(error: Error): never {
    this.dispatchEvent(new CustomEvent('chatkit.error', { detail: { error } }));
    throw error;
  }

  #setOptionsDataAttributes(options: ChatKitOptions) {
    this.dataset.colorScheme =
      typeof options.theme === 'string'
        ? options.theme
        : (options.theme?.colorScheme ?? 'light');
    this.dataset.displayMode = this.#getDisplayMode(options);
    if (this.#getDisplayMode(options) !== 'pet') {
      this.#setLauncherOpen(false);
    }
  }

  #getDisplayMode(options = this.#opts) {
    return options?.displayMode === 'pet' ? 'pet' : 'chat';
  }

  #getConfiguredPetOptions(options = this.#opts): ChatKitOptions['pet'] | null {
    if (!options) {
      return null;
    }

    if (
      this.#getDisplayMode(options) === 'pet' &&
      !normalizePetOptions(options.pet ?? null)
    ) {
      return true;
    }

    return options.pet ?? null;
  }

  #mergeConfiguredPetPositionDefaults(
    pet: ChatKitOptions['pet'] | null,
  ): ChatKitOptions['pet'] | null {
    if (!pet) {
      return pet;
    }

    const configured = normalizePetOptions(
      this.#getConfiguredPetOptions() ?? null,
    );
    if (!configured) {
      return pet;
    }

    if (pet === true) {
      return { position: configured.position };
    }

    if (!pet.position) {
      return { ...pet, position: configured.position };
    }

    return {
      ...pet,
      position: {
        ...configured.position,
        ...pet.position,
        boundsPadding:
          pet.position.boundsPadding ?? configured.position.boundsPadding,
        pin: 'pin' in pet.position ? pet.position.pin : configured.position.pin,
      },
    };
  }

  #getOverlayPetOptions(): ChatKitOptions['pet'] | null {
    if (this.#petClosedByContextMenu) {
      return null;
    }

    let pet;
    if (this.#framePetOptionsOverride !== undefined) {
      pet = this.#mergeConfiguredPetPositionDefaults(
        this.#framePetOptionsOverride,
      );
    } else {
      pet = this.#getConfiguredPetOptions();
    }

    if (this.#getDisplayMode() === 'pet' && !normalizePetOptions(pet ?? null)) {
      pet = true;
    }

    return this.#resolveOverlayPetOptions(pet);
  }

  #resolvePetAssetUrl(src: string): string {
    try {
      const base = new URL(
        this.#frameUrl ?? window.location.href,
        window.location.origin,
      );
      return new URL(src, base).toString();
    } catch {
      return src;
    }
  }

  #resolveOverlayPetOptions(
    pet: ChatKitOptions['pet'] | null,
  ): ChatKitOptions['pet'] | null {
    const normalized = normalizePetOptions(pet ?? null);
    if (!normalized) {
      return null;
    }

    return {
      character: {
        ...normalized.character,
        src: this.#resolvePetAssetUrl(normalized.character.src),
      },
      position: normalized.position,
      behavior: normalized.behavior,
      ariaLabel: normalized.ariaLabel,
      imageRendering: normalized.imageRendering,
    };
  }

  #getFrameOptions(options: ChatKitOptions): ChatKitOptions {
    const pet = this.#getConfiguredPetOptions(options);
    if (pet === (options.pet ?? null)) {
      return options;
    }

    const nextOptions = { ...options };
    if (pet === null) {
      delete nextOptions.pet;
    } else {
      nextOptions.pet = pet;
    }
    return nextOptions;
  }

  #setLauncherOpen(open: boolean) {
    this.#launcherOpen = open;
    if (open) {
      this.dataset.chatOpen = 'true';
    } else {
      delete this.dataset.chatOpen;
    }
  }

  #setChatMinimizedToPet(minimized: boolean) {
    const next = minimized && Boolean(this.#getOverlayPetOptions());
    this.#chatMinimizedToPet = next;
    if (next) {
      this.dataset.chatMinimizedToPet = 'true';
    } else {
      delete this.dataset.chatMinimizedToPet;
    }
  }

  #syncPetOverlayOptions() {
    const overlayPetOptions = this.#getOverlayPetOptions();
    this.#petOverlay.setOptions(overlayPetOptions, this.#opts?.theme);
    if (!overlayPetOptions) {
      this.#setChatMinimizedToPet(false);
    }
  }

  #handlePetActivate() {
    if (this.#chatMinimizedToPet) {
      this.#setChatMinimizedToPet(false);
      if (this.#getDisplayMode() === 'pet') {
        this.#setLauncherOpen(true);
      }
      this.#loaded.then(() => this.focusComposer()).catch(() => undefined);
      return;
    }

    if (this.#getDisplayMode() !== 'pet') {
      return;
    }

    this.#setLauncherOpen(true);
    this.#loaded.then(() => this.focusComposer()).catch(() => undefined);
  }

  #handlePetClose() {
    this.#petClosedByContextMenu = true;
    this.#framePetOptionsOverride = null;
    this.#setChatMinimizedToPet(false);
    this.#setLauncherOpen(false);
    this.#petOverlay.setOptions(null);

    if (this.#getDisplayMode() === 'pet') {
      return;
    }

    this.#loaded
      .then(() => this.#messenger.commands.setPetEnabled({ enabled: false }))
      .catch(() => undefined);
  }

  async #handlePetReply(text: string) {
    await this.sendUserMessage({ text });
  }

  async #handlePetThreadSummaryActivate(threadId: string) {
    if (this.#getDisplayMode() === 'pet') {
      this.#setLauncherOpen(true);
    }

    await this.setThreadId(threadId);
    await this.focusComposer();
  }

  #handleLauncherClose = () => {
    this.#setLauncherOpen(false);
  };

  #getFrameUrl() {
    if (!this.#frameUrl) {
      throw new IntegrationError(
        'ChatKit frameUrl is not configured. Provide it via setOptions({ frameUrl }) before mounting.',
      );
    }
    return this.#frameUrl;
  }

  #setFrameUrl(frameUrl: string) {
    if (this.#initialized && this.#frameUrl && this.#frameUrl !== frameUrl) {
      throw new IntegrationError(
        'ChatKit frameUrl cannot be changed after initialization. Create a new element to use a different URL.',
      );
    }
    this.#frameUrl = frameUrl;
  }

  #consumeFrameUrl(options: ChatKitOptions) {
    if (!('frameUrl' in options)) return;
    const frameUrl = options.frameUrl;
    delete options.frameUrl;
    if (frameUrl == null) return;
    if (typeof frameUrl !== 'string' || frameUrl.trim() === '') {
      throw new IntegrationError(
        'ChatKit frameUrl must be a non-empty string.',
      );
    }
    this.#setFrameUrl(frameUrl);
  }

  #handleFrameLoad = () => {
    this.dataset.loaded = 'true';
    this.dispatchEvent(
      new CustomEvent('chatkit.ready', { bubbles: true, composed: true }),
    );
    this.#resolveLoaded?.();
  };

  connectedCallback() {
    this.#petOverlay.connect();
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        position: relative;
        height: 100%;
        width: 100%;
        overflow: visible;
      }
      :host([data-display-mode="pet"]) {
        display: contents;
      }
      :host([data-chat-minimized-to-pet="true"]) {
        display: contents;
      }
      .ck-iframe {
        border: none;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        color-scheme: light only;
      }
      .ck-wrapper {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        opacity: 0;
      }
      .ck-launcher-close {
        display: none;
      }
      :host([data-display-mode="pet"]) .ck-wrapper {
        position: fixed;
        inset: auto 16px 16px auto;
        width: min(420px, calc(100vw - 32px));
        height: min(720px, calc(100vh - 32px));
        max-height: calc(100vh - 32px);
        overflow: visible;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 18px;
        background: Canvas;
        box-shadow:
          0 24px 80px rgba(15, 23, 42, 0.22),
          0 0 0 1px rgba(15, 23, 42, 0.04);
        opacity: 0;
        pointer-events: none;
        transform: translateY(12px) scale(0.98);
        transition:
          opacity 160ms ease,
          transform 160ms ease;
        z-index: 39;
      }
      :host([data-display-mode="pet"][data-chat-open="true"]) .ck-wrapper {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }
      :host([data-display-mode="pet"]) .ck-iframe {
        border-radius: inherit;
      }
      :host([data-display-mode="pet"]) .ck-launcher-close {
        display: inline-flex;
        position: absolute;
        top: -10px;
        right: -10px;
        z-index: 2;
        width: 28px;
        height: 28px;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(148, 163, 184, 0.45);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.96);
        color: #475569;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
        cursor: pointer;
        font: inherit;
        font-size: 0;
        line-height: 1;
      }
      :host([data-display-mode="pet"]) .ck-launcher-close::before,
      :host([data-display-mode="pet"]) .ck-launcher-close::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 14px;
        height: 2px;
        border-radius: 999px;
        background: currentColor;
        transform: translate(-50%, -50%) rotate(45deg);
      }
      :host([data-display-mode="pet"]) .ck-launcher-close::after {
        transform: translate(-50%, -50%) rotate(-45deg);
      }
      :host([data-display-mode="pet"]) .ck-launcher-close:hover {
        background: #fff;
        color: #0f172a;
      }
      :host([data-color-scheme="dark"]) .ck-iframe {
        color-scheme: dark only;
      }
      :host([data-color-scheme="dark"][data-display-mode="pet"]) .ck-wrapper {
        border-color: rgba(148, 163, 184, 0.28);
        background: #020617;
        box-shadow:
          0 24px 80px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.06);
      }
      :host([data-color-scheme="dark"][data-display-mode="pet"]) .ck-launcher-close {
        background: rgba(15, 23, 42, 0.88);
        border-color: rgba(148, 163, 184, 0.32);
        color: #cbd5e1;
      }
      :host([data-color-scheme="dark"][data-display-mode="pet"]) .ck-launcher-close:hover {
        background: #1e293b;
        color: #f8fafc;
      }
      :host([data-loaded="true"]) .ck-wrapper {
        opacity: 1;
      }
      :host([data-chat-minimized-to-pet="true"]) .ck-wrapper {
        opacity: 0;
        pointer-events: none;
        visibility: hidden;
      }
      :host([data-display-mode="pet"]:not([data-chat-open="true"])) .ck-wrapper {
        opacity: 0;
      }
      @media (max-width: 520px) {
        :host([data-display-mode="pet"]) .ck-wrapper {
          inset: auto 8px 8px 8px;
          width: auto;
          height: min(680px, calc(100vh - 16px));
          max-height: calc(100vh - 16px);
          border-radius: 16px;
        }
        :host([data-display-mode="pet"]) .ck-launcher-close {
          top: -8px;
          right: 8px;
        }
      }
    `;

    const frame = document.createElement('iframe');
    frame.className = 'ck-iframe';
    frame.name = 'chatkit';
    frame.role = 'presentation';
    frame.tabIndex = 0;
    frame.setAttribute('allowtransparency', 'true');
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('allow', 'clipboard-read; clipboard-write');
    this.#frame = frame;

    // not sure we still need this..
    const wrapper = document.createElement('div');
    wrapper.className = 'ck-wrapper';
    wrapper.appendChild(frame);
    this.#wrapper = wrapper;

    const closeButton = document.createElement('button');
    closeButton.className = 'ck-launcher-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close chat');
    closeButton.addEventListener('click', this.#handleLauncherClose);
    wrapper.appendChild(closeButton);
    this.#launcherCloseButton = closeButton;

    this.#shadow.append(style);

    if (import.meta.env.DEV) {
      this.#messenger.on('development_only_force_page_reload', () => {
        window.location.reload();
      });
    }
    this.#messenger.on('left_header_icon_click', () => {
      this.#opts?.header?.leftAction?.onClick();
    });
    this.#messenger.on('right_header_icon_click', () => {
      this.#opts?.header?.rightAction?.onClick();
    });
    this.#messenger.on('public_event', ([event, data]) => {
      if (event === 'log') {
        const payload = parseThreadSummaryLogPayload(data);
        if (payload) {
          this.#petOverlay.setThreadSummary(payload.summary);
        }
      } else if (event === 'response.start') {
        this.#petOverlay.setThreadSummaryStatus('running');
      } else if (event === 'response.end') {
        this.#petOverlay.setThreadSummaryStatus('completed');
      } else if (event === 'response.stop') {
        this.#petOverlay.setThreadSummaryStatus('completed');
      }

      if (!this.capabilities.events.has(event)) return;
      if (event === 'error' && 'error' in data) {
        // Custom error handling to convert frame-safe errors back into real Errors
        const error = fromPossibleFrameSafeError(data.error);
        this.dispatchEvent(
          new CustomEvent('chatkit.error', { detail: { error } }),
        );
        // IntegrationErrors should throw
        if (error instanceof IntegrationError) {
          throw error;
        }
        return;
      }

      this.dispatchEvent(new CustomEvent(`chatkit.${event}`, { detail: data }));
    });
    this.#messenger.on('pet_state_change', (data) => {
      const payload = parsePetStateChangePayload(data);
      if (payload) {
        this.#petOverlay.setState(payload.state);
      }
    });
    this.#messenger.on('pet_options_change', (data) => {
      const payload = parsePetOptionsChangePayload(data);
      if (payload) {
        if (!this.#petClosedByContextMenu || payload.pet === null) {
          this.#petClosedByContextMenu = false;
        }
        this.#framePetOptionsOverride = payload.pet;
        this.#syncPetOverlayOptions();
      }
    });
    this.#messenger.on('chat_minimize_change', (data) => {
      const minimized =
        typeof data === 'object' &&
        data !== null &&
        'minimized' in data &&
        (data as { minimized?: unknown }).minimized === true;

      if (minimized && !this.#getOverlayPetOptions()) {
        return;
      }

      this.#setChatMinimizedToPet(minimized);
      if (minimized) {
        this.#setLauncherOpen(false);
      }
    });
    this.#messenger.on('unmount', () => {
      // Remove the iframe and wrapper from the shadow DOM if they exist
      if (this.#wrapper && this.#shadow.contains(this.#wrapper)) {
        this.#shadow.removeChild(this.#wrapper);
        this.#wrapper = undefined;
        this.#frame = undefined;
      }
    });
    this.#messenger.on(
      'capabilities_profile_change',
      ({ profile }: { profile: ChatKitProfile }) => {
        this.setProfile(profile);
      },
    );

    frame.addEventListener('load', this.#handleFrameLoad, { once: true });

    try {
      this.#maybeInit();
    } catch (error) {
      console.error(error);
      this.#emitAndThrow(
        error instanceof Error
          ? error
          : new IntegrationError('Failed to initialize ChatKit'),
      );
    }
  }

  #initialized = false;
  #maybeInit() {
    if (this.#initialized || !this.#frame || !this.#opts) {
      return;
    }
    this.#initialized = true;
    this.#setOptionsDataAttributes(this.#opts);
    const frameURL = new URL(this.#getFrameUrl(), window.location.origin);
    this.#messenger.setTargetOrigin(frameURL.origin);
    frameURL.hash = encodeBase64({
      options: getInnerOptions(this.#getFrameOptions(this.#opts)),
      referrer: window.location.origin,
      profile: this.profile,
      ...(this.#channelId ? { channelId: this.#channelId } : {}),
    } satisfies ChatKitFrameParams);
    this.#messenger.connect();
    this.#frame.src = frameURL.toString();
    // Impossible to not exist
    if (this.#wrapper) {
      this.#shadow.append(this.#wrapper);
    }
  }

  disconnectedCallback() {
    this.#frame?.removeEventListener('load', this.#handleFrameLoad);
    this.#launcherCloseButton?.removeEventListener(
      'click',
      this.#handleLauncherClose,
    );
    this.#messenger.disconnect();
    this.#petOverlay.destroy();
  }

  protected applySanitizedOptions(newOptions: ChatKitOptions) {
    this.#opts = newOptions;
    this.#petClosedByContextMenu = false;
    this.#petOverlay.setLocale(newOptions.locale);
    this.#syncPetOverlayOptions();
    if (this.#initialized) {
      this.#setOptionsDataAttributes(this.#opts);
      this.#loaded.then(() => {
        this.#messenger.commands.setOptions(
          getInnerOptions(this.#getFrameOptions(newOptions)),
        );
      });
    } else {
      this.#maybeInit();
    }
  }

  setOptions(newOptions: TRawOptions) {
    try {
      const sanitized = this.sanitizeOptions(newOptions);
      this.#consumeFrameUrl(sanitized);
      this.applySanitizedOptions(sanitized);
    } catch (error) {
      this.#emitAndThrow(
        error instanceof Error
          ? error
          : new IntegrationError('Failed to parse options'),
      );
    }
  }

  @requireCommandCapability
  async focusComposer() {
    await this.#loaded;
    this.#frame?.focus();
    await this.#messenger?.commands.focusComposer();
  }

  @requireCommandCapability
  async fetchUpdates() {
    await this.#loaded;
    await this.#messenger?.commands.fetchUpdates();
  }

  @requireCommandCapability
  async sendUserMessage(params: SendUserMessageParams) {
    await this.#loaded;
    await this.#messenger?.commands.sendUserMessage(params);
  }

  @requireCommandCapability
  async setComposerValue(params: {
    text?: string;
    content?: UserMessageContent[];
    reply?: string;
    attachments?: Attachment[];
    references?: ChatKitReference[];
    appendReferences?: boolean;
    files?: File[];
    selectedToolId?: string | null;
    selectedModelId?: string | null;
    runtimeCapabilities?: RuntimeCapabilitiesSelection | null;
    insertRuntimeCapabilities?: boolean;
  }) {
    await this.#loaded;
    await this.#messenger?.commands.setComposerValue(params);
  }

  @requireCommandCapability
  async setRuntimeCapabilities(selection: RuntimeCapabilitiesSelection | null) {
    await this.#loaded;
    await this.#messenger?.commands.setRuntimeCapabilities(selection);
  }

  @requireCommandCapability
  async setThreadId(threadId: string | null) {
    await this.#loaded;
    await this.#messenger?.commands.setThreadId({ threadId });
  }

  @requireCommandCapability
  async shareThread() {
    await this.#loaded;
    return this.#messenger?.commands.shareThread();
  }

  @requireCommandCapability
  async sendCustomAction(
    action: { type: string; payload?: Record<string, unknown> },
    itemId?: string,
  ) {
    await this.#loaded;
    return this.#messenger?.commands.sendCustomAction({ action, itemId });
  }

  @requireCommandCapability
  async showHistory() {
    await this.#loaded;
    return this.#messenger?.commands.showHistory();
  }

  @requireCommandCapability
  async hideHistory() {
    await this.#loaded;
    return this.#messenger?.commands.hideHistory();
  }

  @requireCommandCapability
  async setTrainingOptOut(value: boolean) {
    await this.#loaded;
    return this.#messenger?.commands.setTrainingOptOut({ value });
  }
}

export interface ChatKitBaseElement<
  TRawOptions,
  TSanitizedOptions extends ChatKitOptions,
> extends HTMLElement {
  addEventListener<K extends keyof ChatKitBaseElementEventMap>(
    type: K,
    listener: (
      this: ChatKitBaseElement<TRawOptions, TSanitizedOptions>,
      ev: ChatKitBaseElementEventMap[K],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<K extends keyof ChatKitBaseElementEventMap>(
    type: K,
    listener: (
      this: ChatKitBaseElement<TRawOptions, TSanitizedOptions>,
      ev: ChatKitBaseElementEventMap[K],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}
