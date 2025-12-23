import type { EventSourceMessage, FetchEventSourceInit } from "@microsoft/fetch-event-source"

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

export type AnyFunction = (...args: any[]) => any