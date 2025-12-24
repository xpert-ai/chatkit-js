import type { EventSourceMessage, FetchEventSourceInit } from "@microsoft/fetch-event-source"

export type ChatKitMessage =
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

export type InnerCommands = any
export type InnerEvents = any
export type OuterCommands = any
export type OuterEvents = any


export type Attachment = any
export type ChatKitFrameParams = any
export type ChatKitProfile = any
export type ChatKitInnerOptions = any
export type ChatKitReq = any
export type UserMessageContent = any
export type ToolChoice = any

export type RemoveMethods<T> = T extends AnyFunction ? "[ChatKitMethod]" : T extends object ? { [K in keyof T]: RemoveMethods<T[K]>; } : T;
export type Capabilities = any
export class IntegrationError extends Error {}

export enum Capability {
  Command = "Command"
}

export function getCapabilities(profile: ChatKitProfile): Capabilities {
  // Placeholder implementation
}

export function fromPossibleFrameSafeError(err: any): any {
  // Placeholder implementation
  return err.message
}