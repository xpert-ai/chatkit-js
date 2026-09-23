# Collapsible assistant process

Enable the presentation on any ChatKit instance:

```ts
const options: ChatKitOptions = {
  api: {
    /* your existing API configuration */
  },
  messagePresentation: { collapseProcess: true },
};
```

Omit the option or use `false` to retain the full transcript. This affects rendering only, never persisted messages, model context, checkpoint boundaries, or branch targets.

Each completed assistant reply keeps its final root text and accompanying images, widgets, and MCP App results visible. Earlier root text, reasoning, ordinary tool steps, and child-agent output are placed in a disclosure above the reply. Contiguous answer blocks stay together. A reply containing only text needs no disclosure. Tool output after the last root text is not treated as a final answer.

Adjacent assistant/tool records can share the disclosure when they belong to the same human turn and execution lineage. Grouping never crosses a human, system, or event record. Missing pagination prefixes and conflicting execution identities stay separate. Steer inputs are human boundaries; resumed executions can use existing `rootExecutionIds` lineage. If the boundary cannot be established, the content remains visible.

While streaming, the process starts expanded and the latest root text remains visible. Successful completion collapses it unless the user has explicitly chosen an expansion state. Errors, interrupted or paused runs, and messages lacking completion status remain expanded. Unknown or interactive process components are never silently folded, including approvals, questions, widgets and MCP Apps. A reply without a final root answer remains visible in full.

The disclosure shows **Took 7m 59s** / **用时 7分59秒** using the root execution's persisted `elapsedTime`, or its start/end timestamps. Xpert includes the root in execution summaries with `isRoot: true`, including sealed completion events and new branch snapshots. Older branches without root timing retain the **Process** label. Duration is never estimated from message timestamps.

Copy targets the final text, while regenerate and branch continue to target the original final message. Earlier messages remain available inside the process, including their quotation metadata and tool details. Navigation to a grouped message lands on the containing answer.
