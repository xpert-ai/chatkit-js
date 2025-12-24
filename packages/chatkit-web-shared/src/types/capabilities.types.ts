export type ChatKitReq = any

export type OuterCommands = {
    setOptions: any
    sendUserMessage: any
    setComposerValue: any
    setThreadId: any
    focusComposer: any
    fetchUpdates: any
    sendCustomAction: any
    showHistory: any
    hideHistory: any
    shareThread: any
    setTrainingOptOut: any
}
export type PublicEvents = {
    ready: any
    error: any
    log: any
    "response.start": any
    "response.end": any
    "response.stop": any
    "thread.change": any
    "tool.change": any
    "thread.load.start": any
    "thread.load.end": any
    deeplink: any
    effect: any
    'thread.restore': any
    "message.share": any
    "image.download": any
    "history.open": any
    "history.close": any
    "log.chatgpt": any
}
export type PublicError = 'StreamError' | 'StreamEventParsingError' | 'WidgetItemError' | 'InitialThreadLoadError' | 'FileAttachmentError' | 'HistoryViewError' | 'FatalAppError' | 'IntegrationError' | 'EntitySearchError' | 'DomainVerificationRequestError' | 'HttpError' | 'NetworkError' | 'UnhandledError' | 'UnhandledPromiseRejectionError' | 'StreamEventHandlingError' | 'StreamStopError' | 'ThreadRenderingError' | 'IntlError' | 'AppError'
export type ThreadItem = { type: string }
export type WidgetRoot = { type: string }
export type WidgetComponent = { type: string }



// This is a type-only namespace and will disappear after compile.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Capability {
  export type Command = keyof OuterCommands
  export type Event = keyof PublicEvents
  export type Error = PublicError

  export type BackendOperation = ChatKitReq["type"]
  export type ThreadItemType = ThreadItem["type"]
  export type WidgetType = WidgetRoot["type"] | WidgetComponent["type"]

  export type Key =
    | `command.${Command}`
    | `event.${Event}`
    | `thread.item.${ThreadItemType}`
    | `backend.${BackendOperation}`
    | `error.${Error}`
    | `widget.${WidgetType}`

  export type Rules = {
    allow?: readonly Key[] // allow-list
    deny?: readonly Key[] // optional additional denies
  }
}

// Publicly exported capabili
export type Capabilities = {
  commands: Set<Capability.Command>
  events: Set<Capability.Event>
  errors: Set<Capability.Error>
  backend: Set<Capability.BackendOperation>
  threadItems: Set<Capability.ThreadItemType>
  widgets: Set<Capability.WidgetType>
}

// Default capabilities. We intersect this with allow/deny lists on profiles
// to compute effective capabilities.
export const BASE_CAPABILITY_ALLOWLIST = [
  // commands
  "command.setOptions",
  "command.sendUserMessage",
  "command.setComposerValue",
  "command.setThreadId",
  "command.focusComposer",
  "command.fetchUpdates",
  "command.sendCustomAction",
  "command.showHistory",
  "command.hideHistory",
  // events
  "event.ready",
  "event.error",
  "event.log",
  "event.response.start",
  "event.response.end",
  "event.response.stop",
  "event.thread.change",
  "event.tool.change",
  "event.thread.load.start",
  "event.thread.load.end",
  "event.deeplink",
  "event.effect",
  // errors
  "error.StreamError",
  "error.StreamEventParsingError",
  "error.WidgetItemError",
  "error.InitialThreadLoadError",
  "error.FileAttachmentError",
  "error.HistoryViewError",
  "error.FatalAppError",
  "error.IntegrationError",
  "error.EntitySearchError",
  "error.DomainVerificationRequestError",
  // backend
  "backend.threads.get_by_id",
  "backend.threads.list",
  "backend.threads.update",
  "backend.threads.delete",
  "backend.threads.create",
  "backend.threads.add_user_message",
  "backend.threads.add_client_tool_output",
  "backend.threads.retry_after_item",
  "backend.threads.custom_action",
  "backend.attachments.create",
  "backend.attachments.get_preview",
  "backend.attachments.delete",
  "backend.items.list",
  "backend.items.feedback",
  // thread item types
  "thread.item.generated_image",
  "thread.item.user_message",
  "thread.item.assistant_message",
  "thread.item.client_tool_call",
  "thread.item.widget",
  "thread.item.task",
  "thread.item.workflow",
  "thread.item.end_of_turn",
  "thread.item.image_generation",
  // widgets
  "widget.Basic",
  "widget.Card",
  "widget.ListView",
  "widget.ListViewItem",
  "widget.Badge",
  "widget.Box",
  "widget.Row",
  "widget.Col",
  "widget.Button",
  "widget.Caption",
  "widget.Chart",
  "widget.Checkbox",
  "widget.DatePicker",
  "widget.Divider",
  "widget.Form",
  "widget.Icon",
  "widget.Image",
  "widget.Input",
  "widget.Label",
  "widget.Markdown",
  "widget.RadioGroup",
  "widget.Select",
  "widget.Spacer",
  "widget.Text",
  "widget.Textarea",
  "widget.Title",
  "widget.Transition",
] as const satisfies readonly Capability.Key[]

export const BASE_CAPABILITY_DENYLIST = [
  // --- commands
  "command.shareThread",
  "command.setTrainingOptOut",
  // --- events
  "event.thread.restore",
  "event.message.share",
  "event.image.download",
  "event.history.open",
  "event.history.close",
  "event.log.chatgpt",
  // --- errors
  // These errors considered internal and are not exposed to the user by default.
  "error.HttpError",
  "error.NetworkError",
  "error.UnhandledError",
  "error.UnhandledPromiseRejectionError",
  "error.StreamEventHandlingError",
  "error.StreamStopError",
  "error.ThreadRenderingError",
  "error.IntlError",
  "error.AppError",
  // --- backend
  "backend.threads.stop",
  "backend.threads.share",
  "backend.threads.create_from_shared",
  "backend.threads.init",
  "backend.attachments.process",
  // widgets
  "widget.CardCarousel",
  "widget.Favicon",
  "widget.CardLinkItem",
  "widget.Map",
] as const satisfies readonly Capability.Key[]

export const PROFILE_TO_RULES = {
  "chatkit": {
    allow: [...BASE_CAPABILITY_ALLOWLIST, "thread.item.image_generation"],
    deny: BASE_CAPABILITY_DENYLIST,
  },
}