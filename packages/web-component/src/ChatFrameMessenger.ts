import { BaseMessenger } from "@xpert-ai/chatkit-web-shared"
import { InnerCommands, InnerEvents, OuterCommands, OuterEvents } from "@xpert-ai/chatkit-web-shared"

export class ChatFrameMessenger extends BaseMessenger<
  OuterCommands,
  InnerCommands,
  OuterEvents,
  InnerEvents
> {
  // Messenger running in outer can always handle commands coming from inner
  canReceiveCommand(_: string) {
    return true
  }
}
