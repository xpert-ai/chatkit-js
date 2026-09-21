# External Assistant execution views

External Assistant calls appear as compact execution rows in the main transcript.
Selecting a row opens the native **External assistants** Workbench tab. The tab
shows the selected execution's input, status, elapsed time, model (when supplied),
and streamed messages. Its back button opens the execution list. Repeated calls
to the same Assistant remain separate executions.

Both the main chat and the external execution view use `thread/MessageList`.
The execution adapter projects the selected run's input and output into regular
messages, retaining tool components, reasoning, and descendant run identities.
The view only owns execution navigation and metadata; it has no separate message
renderer. Copying is shared, while retry is supplied only by the main chat.

This view is enabled by default and does not require remote view manifests or
`workbench.enabled`. Closing the tab only closes the view; it does not cancel a
run or copy a thread. Switching conversations clears the selection. Sub-agents
retain their inline expandable groups, including those inside external calls.

To retain inline rendering for all executions:

```ts
workbench: {
  externalAssistants: { enabled: false },
}
```

## Server and SDK compatibility

The Xpert invocation boundary records `metadata.invocationKind` as
`external_assistant` or `sub_agent`. Live `ON_AGENT_START` / `ON_AGENT_END` events
carry this metadata. Conversation message list/search responses add `agentRuns`
summaries, described by the SDK's `ChatAgentRunSummary`, so reloading a thread
preserves the same classification. Both changes must be deployed with ChatKit
for complete live/history behavior; no database schema migration is required.

Historical summaries are limited to the authorized conversation's threads and
descendants of the returned messages' execution roots. Model labels use execution
metadata rather than the main chat's current model selection. No reasoning-effort
label is displayed without a corresponding execution contract.

Execution events carry `metadata.assistantAvatar`; historical summaries expose
`avatar`, with a fallback to the execution's related expert for older records.
The server resolves legacy Emoji Mart IDs to Unicode. Call rows, execution lists,
and detail headers reuse `ChatkitAvatar`, falling back to the bot icon when no
avatar is configured.

Legacy executions without an explicit invocation kind retain inline rendering.
ChatKit does not classify them by name, agent key, or category. Side chat retains
inline rendering within its separate conversation.
