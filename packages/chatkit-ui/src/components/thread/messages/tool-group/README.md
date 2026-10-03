# Tool component groups

`../tool-component-group.tsx` remains the public entry point. It renders the
collapsible summary and the list of tool-call rows, and re-exports the existing
types and helpers for other message renderers.

- `grouping/` builds render units, classifies activities, and formats their labels.
- `status/` normalizes incremental step data, resolves running/paused/idle status,
  and manages elapsed or frozen duration labels.
- `icons/` selects explicit icons, toolset avatars, and category fallbacks.
- `details/` selects the input/output or custom renderer, including the existing
  sandbox shell card. It reuses `../tool-call-output.tsx` for attachments, errors,
  copy actions, and legacy embedded-image summaries.
- `rows/` composes a single memoized tool-call row with its expansion state.
- `types.ts` holds the shared partial-step and render-unit contracts.

Keep internal helpers private unless another module needs them. Submodules import
one another directly rather than importing the public entry point. The existing
`../ai.test.tsx` coverage exercises these modules through the message renderer,
including grouping, incremental updates, pause state, and tool details.
