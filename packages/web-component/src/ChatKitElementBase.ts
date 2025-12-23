import { encodeBase64 } from "@xpert-ai/chatkit-web-shared"

import { ChatFrameMessenger } from "./ChatFrameMessenger"
import { ChatKitOptions } from "@xpert-ai/chatkit-types"
import { removeMethods } from "./helpers"

import type {
  Attachment,
  ChatKitFrameParams,
  ChatKitProfile,
  ChatKitInnerOptions,
  ChatKitReq,
  UserMessageContent,
  ToolChoice,
} from "@xpert-ai/chatkit-web-shared"
import { getCapabilities } from "@xpert-ai/chatkit-web-shared"
import type { Capabilities, Capability } from "@xpert-ai/chatkit-web-shared"
import { IntegrationError, fromPossibleFrameSafeError } from "@xpert-ai/chatkit-web-shared"

const CHATKIT_FRAME_URL = import.meta.env.VITE_CHATKIT_FRAME_URL

// Compute inner options by removing methods (to make options serializable)
function getInnerOptions(options: ChatKitOptions): ChatKitInnerOptions {
  return removeMethods(options) as ChatKitInnerOptions
}

// Decorator to assert that a command is available for the current capabilities profile
export function requireCommandCapability<
  This extends ChatKitElementBase<unknown>,
  Args extends unknown[],
  Return,
>(
  value: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
  const command = String(context.name)
  return function (this: This, ...args: Args) {
    if (!this.capabilities.commands.has(command as Capability.Command)) {
      throw new IntegrationError(
        `ChatKit command "${String(command)}" is not available for the "${this.profile}" profile.`,
      )
    }
    return value.apply(this, args)
  }
}

interface ChatKitBaseElementEventMap {
  "chatkit.ready": CustomEvent<void>
  "chatkit.error": CustomEvent<{ error: Error }>
  "chatkit.response.start": CustomEvent<void>
  "chatkit.response.end": CustomEvent<void>
  "chatkit.thread.change": CustomEvent<{ threadId: string | null }>
  "chatkit.log": CustomEvent<{ name: string; data?: Record<string, unknown> }>
  "chatkit.deeplink": CustomEvent<{ name: string; data?: Record<string, unknown> }>
  "chatkit.widget.action": CustomEvent<{ action: string; payload?: Record<string, unknown> }>
}

export abstract class ChatKitElementBase<TRawOptions> extends HTMLElement {
  protected profile: ChatKitProfile
  protected capabilities: Capabilities
  protected abstract sanitizeOptions(options: TRawOptions): ChatKitOptions

  #opts?: ChatKitOptions
  #frame?: HTMLIFrameElement
  #wrapper?: HTMLDivElement

  #shadow = this.attachShadow({ mode: "open" })

  #resolveLoaded?: () => void
  #loaded = new Promise<void>((resolve) => {
    this.#resolveLoaded = resolve
  })

  #messenger = new ChatFrameMessenger({
    fetch: ((...args) => {
      const customFetch = this.#opts?.api && "fetch" in this.#opts.api && this.#opts.api.fetch
      return customFetch ? customFetch(...args) : fetch(...args)
    }) as typeof fetch,
    target: () => this.#frame?.contentWindow ?? null,
    targetOrigin: new URL(CHATKIT_FRAME_URL, window.location.origin).origin,
    handlers: {
      onFileInputClick: ({ inputAttributes }) => {
        return new Promise<File[]>((resolve) => {
          const input = document.createElement("input")
          for (const [key, value] of Object.entries(inputAttributes)) {
            input.setAttribute(key, String(value))
          }
          const respond = () => {
            resolve(Array.from(input.files || []))
            if (this.#shadow.contains(input)) {
              this.#shadow.removeChild(input)
            }
          }
          input.addEventListener("cancel", respond)
          input.addEventListener("change", respond)
          this.#shadow.appendChild(input)
          input.click()
        })
      },
      onClientToolCall: async ({
        name,
        params,
      }: {
        name: string
        params: Record<string, unknown>
      }) => {
        const onClientTool = this.#opts?.onClientTool
        if (!onClientTool) {
          this.#emitAndThrow(
            new IntegrationError(
              `No handler for client tool calls. You'll need to add onClientTool to your ChatKit options.`,
            ),
          )
        }
        return onClientTool({ name, params })
      },
      onWidgetAction: async ({ action, widgetItem }) => {
        const onAction = this.#opts?.widgets?.onAction
        if (!onAction) {
          this.#emitAndThrow(
            new IntegrationError(
              `No handler for widget actions. You'll need to add widgets.onAction to your ChatKit options.`,
            ),
          )
        }
        return onAction(action, widgetItem)
      },
      onEntitySearch: async ({ query }) => this.#opts?.entities?.onTagSearch?.(query) ?? [],
      onEntityClick: async ({ entity }) => this.#opts?.entities?.onClick?.(entity),
      onEntityPreview: async ({ entity }) =>
        this.#opts?.entities?.onRequestPreview?.(entity) ?? { preview: null },
      onGetClientSecret: async (currentClientSecret: string | null) => {
        if (
          !this.#opts ||
          !("getClientSecret" in this.#opts.api) ||
          !this.#opts.api.getClientSecret
        ) {
          // ~Impossible since the existence of this handler is the only way
          // that we end up creating the kind of ApiClient that would call this handler in the first place.
          this.#emitAndThrow(
            new IntegrationError(
              "Could not refresh the session because ChatKitOptions.api.getClientSecret is not configured.",
            ),
          )
        }

        return this.#opts.api.getClientSecret(currentClientSecret ?? null)
      },
      onAddMetadataToRequest: ({
        op,
        params,
      }: {
        op: ChatKitReq["type"]
        params: Record<string, unknown>
      }): Promise<Record<string, unknown> | null> | null => {
        if (!this.#opts) return null
        if (!("addMetadataToRequest" in this.#opts.api) || !this.#opts.api.addMetadataToRequest)
          return null

        const result = this.#opts.api.addMetadataToRequest({ op, params })
        if (!result) return null

        return result.then((value) => {
          if (!value) return null
          if (typeof value !== "object" || Array.isArray(value)) {
            throw new IntegrationError(
              "ChatKit: addMetadataToRequest must return an object or null.",
            )
          }
          return value as Record<string, unknown>
        })
      },
    },
  })

  constructor({ profile }: { profile: ChatKitProfile }) {
    super()
    this.profile = profile
    this.capabilities = getCapabilities(profile)
  }

  protected setProfile(profile: ChatKitProfile) {
    this.profile = profile
    this.capabilities = getCapabilities(profile)
  }

  #emitAndThrow(error: Error): never {
    this.dispatchEvent(new CustomEvent("chatkit.error", { detail: { error } }))
    throw error
  }

  #setOptionsDataAttributes(options: ChatKitOptions) {
    this.dataset.colorScheme =
      typeof options.theme === "string" ? options.theme : options.theme?.colorScheme ?? "light"
  }

  #handleFrameLoad = () => {
    this.dataset.loaded = "true"
    this.dispatchEvent(new CustomEvent("chatkit.ready", { bubbles: true, composed: true }))
    this.#resolveLoaded?.()
  }

  connectedCallback() {
    const style = document.createElement("style")
    style.textContent = `
      :host {
        display: block;
        position: relative;
        height: 100%;
        width: 100%;
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
      :host([data-color-scheme="dark"]) .ck-iframe {
        color-scheme: dark only;
      }
      :host([data-loaded="true"]) .ck-wrapper {
        opacity: 1;
      }
    `

    const frame = document.createElement("iframe")
    frame.className = "ck-iframe"
    frame.name = "chatkit"
    frame.role = "presentation"
    frame.tabIndex = 0
    frame.setAttribute("allowtransparency", "true")
    frame.setAttribute("frameborder", "0")
    frame.setAttribute("scrolling", "no")
    frame.setAttribute("allow", "clipboard-read; clipboard-write")
    this.#frame = frame

    // not sure we still need this..
    const wrapper = document.createElement("div")
    wrapper.className = "ck-wrapper"
    wrapper.appendChild(frame)
    this.#wrapper = wrapper

    this.#shadow.append(style)

    if (import.meta.env.DEV) {
      this.#messenger.on("development_only_force_page_reload", () => {
        window.location.reload()
      })
    }
    this.#messenger.on("left_header_icon_click", () => {
      this.#opts?.header?.leftAction?.onClick()
    })
    this.#messenger.on("right_header_icon_click", () => {
      this.#opts?.header?.rightAction?.onClick()
    })
    this.#messenger.on("public_event", ([event, data]) => {
      if (!this.capabilities.events.has(event)) return
      if (event === "error" && "error" in data) {
        // Custom error handling to convert frame-safe errors back into real Errors
        const error = fromPossibleFrameSafeError(data.error)
        this.dispatchEvent(new CustomEvent("chatkit.error", { detail: { error } }))
        // IntegrationErrors should throw
        if (error instanceof IntegrationError) {
          throw error
        }
        return
      }

      this.dispatchEvent(new CustomEvent(`chatkit.${event}`, { detail: data }))
    })
    this.#messenger.on("unmount", () => {
      // Remove the iframe and wrapper from the shadow DOM if they exist
      if (this.#wrapper && this.#shadow.contains(this.#wrapper)) {
        this.#shadow.removeChild(this.#wrapper)
        this.#wrapper = undefined
        this.#frame = undefined
      }
    })
    this.#messenger.on(
      "capabilities_profile_change",
      ({ profile }: { profile: ChatKitProfile }) => {
        this.setProfile(profile)
      },
    )

    frame.addEventListener("load", this.#handleFrameLoad, { once: true })

    try {
      this.#maybeInit()
    } catch (error) {
      console.error(error)
      this.#emitAndThrow(
        error instanceof Error ? error : new IntegrationError("Failed to initialize ChatKit"),
      )
    }
  }

  #initialized = false
  #maybeInit() {
    if (this.#initialized || !this.#frame || !this.#opts) {
      return
    }
    this.#initialized = true
    this.#setOptionsDataAttributes(this.#opts)
    const frameURL = new URL(CHATKIT_FRAME_URL, window.location.origin)
    frameURL.hash = encodeBase64({
      options: getInnerOptions(this.#opts),
      referrer: window.location.origin,
      profile: this.profile,
    } satisfies ChatKitFrameParams)
    this.#messenger.connect()
    this.#frame.src = frameURL.toString()
    console.log("ChatKit frame URL:", this.#frame.src)
    // Impossible to not exist
    if (this.#wrapper) {
      this.#shadow.append(this.#wrapper)
    }
  }

  disconnectedCallback() {
    this.#frame?.removeEventListener("load", this.#handleFrameLoad)
    this.#messenger.disconnect()
  }

  protected applySanitizedOptions(newOptions: ChatKitOptions) {
    this.#opts = newOptions
    if (this.#initialized) {
      this.#setOptionsDataAttributes(this.#opts)
      this.#loaded.then(() => {
        this.#messenger.commands.setOptions(getInnerOptions(newOptions))
      })
    } else {
      this.#maybeInit()
    }
  }

  setOptions(newOptions: TRawOptions) {
    try {
      const sanitized = this.sanitizeOptions(newOptions)
      this.applySanitizedOptions(sanitized)
    } catch (error) {
      this.#emitAndThrow(
        error instanceof Error ? error : new IntegrationError("Failed to parse options"),
      )
    }
  }

  @requireCommandCapability
  async focusComposer() {
    await this.#loaded
    this.#frame?.focus()
    await this.#messenger?.commands.focusComposer()
  }

  @requireCommandCapability
  async fetchUpdates() {
    await this.#loaded
    await this.#messenger?.commands.fetchUpdates()
  }

  @requireCommandCapability
  async sendUserMessage(params: {
    text?: string
    content?: UserMessageContent[]
    reply?: string
    attachments?: Attachment[]
    toolChoice?: ToolChoice
    model?: string
    newThread?: boolean
  }) {
    await this.#loaded
    await this.#messenger?.commands.sendUserMessage(params)
  }

  @requireCommandCapability
  async setComposerValue(params: {
    text?: string
    content?: UserMessageContent[]
    reply?: string
    attachments?: Attachment[]
    files?: File[]
    selectedToolId?: string
    selectedModelId?: string
  }) {
    await this.#loaded
    await this.#messenger?.commands.setComposerValue(params)
  }

  @requireCommandCapability
  async setThreadId(threadId: string | null) {
    await this.#loaded
    await this.#messenger?.commands.setThreadId({ threadId })
  }

  @requireCommandCapability
  async shareThread() {
    await this.#loaded
    return this.#messenger?.commands.shareThread()
  }

  @requireCommandCapability
  async sendCustomAction(
    action: { type: string; payload?: Record<string, unknown> },
    itemId?: string,
  ) {
    await this.#loaded
    return this.#messenger?.commands.sendCustomAction({ action, itemId })
  }

  @requireCommandCapability
  async showHistory() {
    await this.#loaded
    return this.#messenger?.commands.showHistory()
  }

  @requireCommandCapability
  async hideHistory() {
    await this.#loaded
    return this.#messenger?.commands.hideHistory()
  }

  @requireCommandCapability
  async setTrainingOptOut(value: boolean) {
    await this.#loaded
    return this.#messenger?.commands.setTrainingOptOut({ value })
  }
}

export interface ChatKitBaseElement<TRawOptions, TSanitizedOptions extends ChatKitOptions>
  extends HTMLElement {
  addEventListener<K extends keyof ChatKitBaseElementEventMap>(
    type: K,
    listener: (
      this: ChatKitBaseElement<TRawOptions, TSanitizedOptions>,
      ev: ChatKitBaseElementEventMap[K],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void

  removeEventListener<K extends keyof ChatKitBaseElementEventMap>(
    type: K,
    listener: (
      this: ChatKitBaseElement<TRawOptions, TSanitizedOptions>,
      ev: ChatKitBaseElementEventMap[K],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void
}
