import type { EventSourceMessage, FetchEventSourceInit } from "@microsoft/fetch-event-source"
import { EventEmitter } from "./EventEmitter"
import { fetchEventSourceWithRetry } from "./fetchEventSourceWithRetry.js"
import type { AnyFunction } from "./types"
import { FrameSafeHttpError, HttpError } from "./errors/HttpError"
import { FrameSafeIntegrationError, IntegrationError } from "./errors/IntegrationError"

type ChatKitMessage =
  | {
      type: "command"
      nonce: string
      command: string
      data: unknown
    }
  | {
      type: "response"
      nonce: string
      response?: unknown
      error?: unknown
    }
  | {
      type: "fetch"
      nonce: string
      params: RequestInit
      formData?: Record<string, unknown>
      url: string
    }
  | {
      type: "abortSignal"
      nonce: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reason?: any
    }
  | {
      type: "fetchEventSource"
      nonce: string
      params: Omit<FetchEventSourceInit, "onmessage" | "onerror" | "onopen" | "onclose">
      url: string
    }
  | {
      type: "fetchEventSourceMessage"
      nonce: string
      message: EventSourceMessage
    }
  | {
      type: "event"
      event: string
      data: unknown
    }

/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO - some kind of ready state / queue for messages while waiting for the target to be ready
export abstract class BaseMessenger<
  Commands extends Record<string, AnyFunction> = Record<string, never>,
  ReceivedCommands extends Record<string, AnyFunction> = Record<string, never>,
  Events extends Record<string, any> = Record<string, never>,
  ReceivedEvents extends Record<string, any> = Record<string, never>,
> {
  private targetOrigin: string
  private target: () => Window | null
  private commandHandlers: Record<string, AnyFunction>
  private _fetch: typeof window.fetch

  // Override this method to implement runtime command capability validation
  abstract canReceiveCommand(_: string): boolean

  constructor({
    handlers,
    target,
    targetOrigin,
    fetch = window.fetch,
  }: {
    target: () => Window | null
    targetOrigin: string
    fetch?: typeof window.fetch
    handlers: {
      [K in keyof ReceivedCommands as K extends `${infer C}${infer S}`
        ? `on${Capitalize<C>}${S}`
        : never]: (
        data: Parameters<ReceivedCommands[K]>[0],
      ) => ReturnType<ReceivedCommands[K]> | Promise<ReturnType<ReceivedCommands[K]>>
    }
  }) {
    this.commandHandlers = handlers
    this.target = target
    this.targetOrigin = targetOrigin
    this._fetch = ((...args) => fetch(...args)) as typeof window.fetch
  }

  private emitter = new EventEmitter<Record<string, unknown>>()
  private handlers = new Map<
    string,
    { resolve: (data: unknown) => void; reject: (err: unknown) => void; stack: string }
  >()
  private fetchEventSourceHandlers = new Map<
    string,
    {
      onmessage?: (ev: EventSourceMessage) => void
      onclose?: () => void
    }
  >()
  private abortControllers = new Map<string, AbortController>()

  private sendMessage(data: ChatKitMessage, transfer?: Transferable[]) {
    const message = {
      __xpaiChatKit: true,
      ...data,
    }
    this.target()?.postMessage(message, this.targetOrigin, transfer)
  }

  connect() {
    window.addEventListener("message", this.handleMessage)
  }

  disconnect() {
    window.removeEventListener("message", this.handleMessage)
  }

  fetch<T = unknown>(url: string, params: RequestInit) {
    return new Promise<unknown>((resolve, reject) => {
      const nonce = crypto.randomUUID()
      this.handlers.set(nonce, { resolve, reject, stack: new Error().stack || "" })

      // Special case for FormData since it isn't structured cloneable
      let formData: Record<string, unknown> | undefined
      if (params.body instanceof FormData) {
        formData = {}
        for (const [key, value] of params.body.entries()) {
          formData[key] = value
        }
        params.body = undefined
      }

      // special case for abortSignal since it isn't structured cloneable
      if (params.signal) {
        params.signal.addEventListener("abort", () => {
          this.sendMessage({
            type: "abortSignal",
            nonce,
            reason: params.signal?.reason,
          })
        })
        params.signal = undefined
      }

      this.sendMessage({ type: "fetch", nonce, params, formData, url })
    }) as Promise<T>
  }

  // Supporting onopen would require a good way for us to serialize the Response object
  // across the iframe boundary, which is not trivial and also not really necessary.
  fetchEventSource(
    url: string,
    params: Omit<FetchEventSourceInit, "onopen" | "onerror" | "onclose">,
  ) {
    return new Promise<unknown>((resolve, reject) => {
      const { onmessage, signal, ...rest } = params
      const nonce = crypto.randomUUID()

      this.handlers.set(nonce, { resolve, reject, stack: new Error().stack || "" })
      this.fetchEventSourceHandlers.set(nonce, {
        onmessage,
      })

      // special case for abortSignal since it isn't structured cloneable
      if (signal) {
        signal.addEventListener("abort", () => {
          this.sendMessage({
            type: "abortSignal",
            nonce,
            reason: signal.reason,
          })
        })
      }

      this.sendMessage({ type: "fetchEventSource", nonce, params: rest, url })
    }) as Promise<void>
  }

  commands = new Proxy(
    {},
    {
      get: (_, command: string) => {
        return (data: Record<string, unknown>, transfer?: Transferable[]) => {
          return new Promise<unknown>((resolve, reject) => {
            const nonce = crypto.randomUUID()
            this.handlers.set(nonce, { resolve, reject, stack: new Error().stack || "" })
            this.sendMessage(
              {
                type: "command",
                nonce,
                command: `on${command.charAt(0).toUpperCase()}${command.slice(1)}`,
                data,
              },
              transfer,
            )
          })
        }
      },
    },
  ) as {
    [K in keyof Commands]: (
      ...args: Commands[K] extends () => any
        ? [data?: void, transfer?: void]
        : [data: Parameters<Commands[K]>[0], transfer?: Transferable[]]
    ) => Promise<Awaited<ReturnType<Commands[K]>>>
  }

  emit<E extends keyof Events>(
    ...[event, data, transfer]: Events[E] extends void
      ? [event: E]
      : [event: E, data: Events[E], transfer?: Transferable[]]
  ) {
    this.sendMessage(
      {
        type: "event" as const,
        event: event as string,
        data,
      },
      transfer,
    )
  }

  on<E extends keyof ReceivedEvents>(
    ...[event, callback]: ReceivedEvents[E] extends void
      ? [event: E, callback: () => void]
      : [event: E, callback: (data: ReceivedEvents[E]) => void]
  ) {
    this.emitter.on(event as string, callback as AnyFunction)
  }

  destroy() {
    window.removeEventListener("message", this.handleMessage)
    this.emitter.allOff()
    this.handlers.clear()
  }

  private handleMessage = async (event: MessageEvent) => {
    console.log("Received message", event.data, event.origin, this.targetOrigin, event.source, this.target())
    if (
      !event.data ||
      event.data.__xpaiChatKit !== true ||
      event.origin !== this.targetOrigin ||
      event.source !== this.target()
    ) {
      return
    }

    const data = event.data as ChatKitMessage

    switch (data.type) {
      case "event": {
        this.emitter.emit(data.event, data.data)
        break
      }
      case "fetch": {
        // TODO - handle server errors - non-200 status codes or whatever
        try {
          // Special case for FormData since it isn't structured cloneable
          if (data.formData) {
            const formData = new FormData()
            for (const [key, value] of Object.entries(data.formData)) {
              formData.append(key, value as string)
            }
            data.params.body = formData
          }

          // special case for abortSignal since it isn't structured cloneable
          const controller = new AbortController()
          this.abortControllers.set(data.nonce, controller)
          data.params.signal = controller.signal

          const res = await this._fetch(data.url, data.params)

          if (!res.ok) {
            // TODO - structured errors from ChatKit SDK so we can handle these a bit better
            const message = await res
              .json()
              .then((json) => json.message || res.statusText)
              .catch(() => res.statusText)

            throw new FrameSafeHttpError(message, res)
          }

          // TODO: only accept non-JSON responses when fetching external API
          // (e.g. S3/Azure blob storage uploads)
          const json = await res.json().catch(() => ({}))
          this.sendMessage({
            type: "response",
            response: json,
            nonce: data.nonce,
          })
        } catch (error) {
          this.sendMessage({
            type: "response",
            error,
            nonce: data.nonce,
          })
        }
        break
      }
      case "fetchEventSource": {
        try {
          // special case for abortSignal since it isn't structured cloneable
          const controller = new AbortController()
          this.abortControllers.set(data.nonce, controller)
          await fetchEventSourceWithRetry(data.url, {
            ...data.params,
            signal: controller.signal,
            fetch: this._fetch,
            onmessage: (message) => {
              this.sendMessage({
                type: "fetchEventSourceMessage",
                message,
                nonce: data.nonce,
              })
            },
          })
          this.sendMessage({
            type: "response",
            response: undefined,
            nonce: data.nonce,
          })
        } catch (error) {
          this.sendMessage({
            type: "response",
            error,
            nonce: data.nonce,
          })
        }
        break
      }
      case "command": {
        console.log("Received command", data.command, data.data)
        if (!this.canReceiveCommand(data.command)) {
          this.sendMessage({
            type: "response",
            error: new FrameSafeIntegrationError(`Command ${data.command} not supported`),
            nonce: data.nonce,
          })
          return
        }
        try {
          const response = await this.commandHandlers[data.command]?.(data.data)
          this.sendMessage({
            type: "response",
            response,
            nonce: data.nonce,
          })
        } catch (error) {
          this.sendMessage({
            type: "response",
            error,
            nonce: data.nonce,
          })
        }
        break
      }
      case "response": {
        const handler = this.handlers.get(data.nonce)
        if (!handler) {
          // log this
          // eslint-disable-next-line no-console
          console.error("No handler found for nonce", data.nonce)
          return
        }
        if (data.error) {
          const integrationError = IntegrationError.fromPossibleFrameSafeError(data.error)
          const httpError = HttpError.fromPossibleFrameSafeError(data.error)
          if (integrationError) {
            // Set the stack from the handler so the user can see where the
            // error originated in their own integration code.
            integrationError.stack = handler.stack
            handler.reject(integrationError)
          } else if (httpError) {
            handler.reject(httpError)
          } else {
            handler.reject(data.error)
          }
        } else {
          handler.resolve(data.response)
        }
        this.handlers.delete(data.nonce)
        break
      }
      case "fetchEventSourceMessage": {
        const handler = this.fetchEventSourceHandlers.get(data.nonce)
        if (!handler) {
          // log this
          // eslint-disable-next-line no-console
          console.error("No handler found for nonce", data.nonce)
          return
        }
        this.fetchEventSourceHandlers.get(data.nonce)?.onmessage?.(data.message)
        break
      }
      case "abortSignal": {
        const controller = this.abortControllers.get(data.nonce)
        if (controller) {
          controller.abort(data.reason)
          this.abortControllers.delete(data.nonce)
        }
        break
      }
      default: {
        data satisfies never
        // log this
        break
      }
    }
  }
}
