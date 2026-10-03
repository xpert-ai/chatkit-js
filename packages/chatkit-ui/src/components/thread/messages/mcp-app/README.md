# MCP App message composition

`../mcp-app.tsx` remains the public entry point for `McpAppMessage`,
`isMcpAppComponentData`, `normalizeCallToolResult`,
`normalizeMcpAppResourceResponse`, and `resolveMcpAppSandboxProxy`.
It composes the session hooks and renders the app frame and approval UI.

| Folder | Responsibility |
| --- | --- |
| `resource/` | Resource and tool metadata normalization, tool results, resource loading, and initial tool notifications |
| `sandbox/` | CSP and HTML injection, iframe permissions, approved proxy origins, and sandbox attributes |
| `presentation/` | Host theme variables, locale and direction, HTML styling, and container dimensions |
| `bridge/` | JSON-RPC envelopes, iframe message dispatch, initialization, and conversion of app content into chat input |
| `approval/` | Pending approvals, approve/reject actions, RPC retries, download handling, and expiration |
| `session/` | Mounted app state, iframe references, runtime token synchronization, and teardown |

`types.ts` holds the shared resource and protocol types. Existing `host.ts` and
`theme.ts` retain their paths and exports for approval/download helpers and
standard MCP Apps style mapping.

## Lifecycle and dependency boundaries

- Keep the incoming-data equality guard in the entry component. Equivalent
  streamed component data must not recreate an iframe or restart its RPC session.
- Keep the state hook mounted for the app's lifetime. Switching display modes or
  displaying an approval overlay must not create another session.
- Resource loading, teardown registration, approval expiration, initial tool
  notifications, and bridge registration run in their original effect order.
  The expiration hook is separate from approval callbacks to preserve that order.
- Keep the StrictMode teardown generation check and deferred cleanup together.
  Cleanup uses the captured app identity and window plus the current runtime
  token, and rejects pending approvals before tearing down the app.
- Keep iframe source/origin checks at the bridge boundary. Proxy allowlists,
  sandbox flags, CSP, content validation, and approval enforcement retain their
  existing behavior.
- Feature hook contracts select the state and callbacks they need. Imports used
  only for types stay type-only; helper modules do not import the entry component.
- Platform requests continue to use the SDK client. The existing component and
  normalization tests exercise the public entry; host and theme tests remain
  alongside their helpers.

Follow the repository's file-size guidance in `AGENTS.md` through normal review,
without adding a dedicated line-count gate.
