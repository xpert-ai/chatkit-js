# Branch in new chat

Completed assistant messages can expose **Branch in new chat** directly in the message action bar when the server advertises `branching`. The server creates a new conversation through the selected reply, then ChatKit loads it in the current window, clears and focuses the composer, and waits for a human message. The source run is left running.

```ts
const options = {
  threadItemActions: { branch: true }, // default when supported
};
```

Set `branch: false` to hide the branch button. Read-only transcripts do not receive a branch callback. Servers without the capability field keep the branch button hidden. Unsealed, failed, interrupted, legacy, and intermediate steer replies explain why the action is unavailable; there is no text-copy fallback.

The independent hook retains the request UUID on retry, deduplicates clicks, ignores responses after navigation, and restores the source when the new history fails to load. A successful switch uses the existing `chatkit.thread.change` event. No model request is sent by branching. Errors preserve the source composer draft; a sidebar refresh failure does not undo a successful switch.

History includes saved tool outputs and Agent summaries. Copied MCP App components display their saved result without reconnecting to the original app instance. Message ancestry determines order when timestamps are equal.

**Conversation history can branch; workspace files keep their shared current state.** Workspace files follow the existing project/Assistant sharing rules. Branching does not restore old file bytes, and later edits can be visible in both conversations.

Requires Xpert's conversation-branch migration/API and the branching APIs introduced in `@xpert-ai/xpert-sdk@0.4.0`. This repository now uses the published `0.6.0` SDK. Release order: backend → SDK → ChatKit → hosts.

Copy, edit, regenerate, and branch actions show dark rounded tooltips on hover and keyboard focus. Disabled branch buttons explain why the action is unavailable. Opening a tooltip stops automatic following of streaming output so the action stays visible while a source run continues. Branch failures explain that the source conversation and draft are preserved and can be retried from the same message. When locally linking a newly built SDK, restart Vite with `--force` to invalidate prebundled older SDK code.
