# Inline action approvals

Existing HITL integrations keep composer placement by default. Use the generic option
below to show pending approvals beside the relevant Assistant message:

```ts
const options: ChatKitOptions = {
  // ...api configuration
  approvals: {
    placement: 'inline',
    onDecision: async ({ request, decisions }) => {
      // Verify and apply the decision in your authenticated host.
      // Never implement resource authorization solely in ChatKit UI.
      return host.authorize(request.host, decisions);
    },
    onAction: ({ action }) => {
      if (action === 'settings') host.openPermissions();
    },
  },
};
```

A HITL request may include `toolCallId` to anchor the card to its tool call and
`host: { kind, id, expiresAt }` as an opaque host reference. ChatKit does not interpret
`kind` or make domain-specific API calls. It waits for `onDecision` to return
`{ accepted: true }` before resuming the existing HITL flow. Missing handlers, rejected
promises and negative acknowledgements leave the run paused with an error. Requests
with a host reference always use the guarded inline path even if placement is omitted.

Use existing `actionRequests[].display` sections for readable context, code and tables.
Single approve/reject actions get direct **Allow once** / **Deny** buttons; multi-action,
edit, respond and MCP elicitation requests retain the existing review panel. The host
is responsible for authoritative expiry, scope, immutable arguments and execution
checks. The card disables expired approval and duplicate submissions; switching
threads prevents a late callback from resuming the newly selected thread. Resolved
requests leave the pending card and return to ordinary tool/result history.

The Web Component bridges callbacks to the host; no new `fetch` API is used in ChatKit.
A device host can prepare a command through existing `onClientTool`, then use the
same generic approval callback without coupling native Shell logic into ChatKit.
