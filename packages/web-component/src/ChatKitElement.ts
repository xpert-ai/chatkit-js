import { ChatKitElementBase } from "./ChatKitElementBase"

import type { ChatKitOptions } from "@xpert-ai/chatkit-types"

export class ChatKitElement extends ChatKitElementBase<ChatKitOptions> {
  constructor() {
    super({ profile: "chatkit" })
  }

  override sanitizeOptions(options: ChatKitOptions) {
    // TODO: Sanitize unknown options instead of assuming it is of type ChatKitOptions.
    // The below deletions are expedient for now to prevent ChatGPTShell-only options from
    // being passed to ChatKit.
    delete options.threadItemActions?.share
    return options
  }
}

export function registerChatKitElement(tag = "xpertai-chatkit") {
  // SSR-safe guard
  if (!("customElements" in globalThis)) return

  if (!customElements.get(tag)) {
    customElements.define(tag, ChatKitElement)
  }
}
