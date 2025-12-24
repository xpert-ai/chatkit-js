import {
  PROFILE_TO_RULES,
} from "./types/capabilities.types"

import type { ChatKitProfile } from "./types"
import type { Capabilities, Capability } from "./types/capabilities.types"

export const getCapabilities = (profile: ChatKitProfile): Capabilities => {
  const rules = PROFILE_TO_RULES[profile]
  const effective = new Set(rules.allow as readonly Capability.Key[])
  for (const capability of rules.deny ?? []) {
    effective.delete(capability)
  }

  const commands = new Set<Capability.Command>()
  const events = new Set<Capability.Event>()
  const backend = new Set<Capability.BackendOperation>()
  const threadItems = new Set<Capability.ThreadItemType>()
  const errors = new Set<Capability.Error>()
  const widgets = new Set<Capability.WidgetType>()

  for (const capability of effective) {
    if (capability.startsWith("command.")) {
      commands.add(capability.slice("command.".length) as Capability.Command)
      continue
    }
    if (capability.startsWith("event.")) {
      events.add(capability.slice("event.".length) as Capability.Event)
      continue
    }
    if (capability.startsWith("backend.")) {
      backend.add(capability.slice("backend.".length) as Capability.BackendOperation)
      continue
    }
    if (capability.startsWith("thread.item.")) {
      threadItems.add(capability.slice("thread.item.".length) as Capability.ThreadItemType)
    }
    if (capability.startsWith("error.")) {
      errors.add(capability.slice("error.".length) as Capability.Error)
      continue
    }
    if (capability.startsWith("widget.")) {
      widgets.add(capability.slice("widget.".length) as Capability.WidgetType)
      continue
    }
  }

  return { commands, events, backend, threadItems, errors, widgets }
}