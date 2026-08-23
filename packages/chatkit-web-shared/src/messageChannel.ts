export type ChatKitMessageChannel = {
  channelId?: string
  expectedOrigin: string
  expectedSource: MessageEventSource | null
}

export function isTrustedChatKitMessageEvent(
  event: MessageEvent,
  { channelId, expectedOrigin, expectedSource }: ChatKitMessageChannel,
): boolean {
  const payload = event.data
  if (
    !payload ||
    typeof payload !== "object" ||
    !("__xpaiChatKit" in payload)
  ) {
    return false
  }
  if (payload.__xpaiChatKit !== true) {
    return false
  }
  if (expectedOrigin !== "*" && event.origin !== expectedOrigin) {
    return false
  }
  if (event.source === expectedSource) {
    return true
  }

  const normalizedChannelId = channelId?.trim()
  if (normalizedChannelId) {
    return "channelId" in payload && payload.channelId === normalizedChannelId
  }

  return false
}
