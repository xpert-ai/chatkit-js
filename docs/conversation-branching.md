# Branch in new chat

Completed assistant messages can expose **Branch in new chat / 在新对话中分叉** directly in the message action bar when the server advertises `branching`. The server creates a new conversation through the selected reply, then ChatKit loads it in the current window, clears and focuses the composer, and waits for a human message. The source run is left running.

```ts
const options = {
  threadItemActions: { branch: true }, // default when supported
};
```

Set `branch: false` to hide the branch button. Read-only transcripts do not receive a branch callback. Servers without the capability field keep the branch button hidden. Unsealed, failed, interrupted, legacy, and intermediate steer replies explain why the action is unavailable; there is no text-copy fallback.

The independent hook retains the request UUID on retry, deduplicates clicks, ignores responses after navigation, and restores the source when the new history fails to load. A successful switch uses the existing `chatkit.thread.change` event. No model request is sent by branching. Errors preserve the source composer draft; a sidebar refresh failure does not undo a successful switch.

History includes saved tool outputs and Agent summaries. Copied MCP App components display their saved result without reconnecting to the original app instance. Message ancestry determines order when timestamps are equal.

**历史对话状态可分叉，工作文件保持共享当前状态。** Workspace files follow the existing project/Assistant sharing rules. Branching does not restore old file bytes, and later edits can be visible in both conversations.

Requires Xpert's conversation-branch migration/API and `@xpert-ai/xpert-sdk@^0.4.0`. The lockfile resolves the published 0.4.0 registry package. Release order: backend → SDK → ChatKit → hosts.

Copy, edit, regenerate, and branch actions show dark rounded tooltips on hover and keyboard focus. Disabled branch buttons explain why the action is unavailable. Opening a tooltip stops automatic following of streaming output so the action stays visible while a source run continues. Branch failures explain that the source conversation and draft are preserved and can be retried from the same message. When locally linking a newly built SDK, restart Vite with `--force` to invalidate prebundled older SDK code.
