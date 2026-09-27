# @xpert-ai/chatkit-types

## 0.6.3

### Patch Changes

- 614b5c0: Separate delivered files from workspace file changes using typed file-activity receipts and versioned artifact references. Display delivery cards, file-type icons, and file-change summaries with review actions while keeping internal activity out of tool-call lists. Apply theme radius and density settings to the related surfaces, and use the published Xpert SDK 0.4.2 for file-change statistics.

## 0.6.2

### Patch Changes

- 0cffd76: Add typed conversation references and inline @ title search. Persist thread locators for an Xpert built-in read_thread middleware, with atomic composer chips and submission recovery. Upgrade the Xpert SDK dependency to ^0.4.1 for cancellation on conversations.search. Requires the companion Xpert backend.
- fdc0a44: Persist skill load observations and display the skills used by each assistant
  message in an accessible footer popover, including skill origins.

## 0.6.1

### Patch Changes

- 8ee52f7: Add a direct Branch in new chat action and tooltips for message action buttons to completed assistant messages that advertise a sealed server checkpoint. Requires Xpert SDK 0.4.0 and the conversation branching backend migration. Preserve source drafts on failure, deduplicate retries, and ignore responses after navigation. Historical app results are displayed without reconnecting to source executions.
- 56407c3: Add opt-in `messagePresentation.collapseProcess` to group assistant progress and tool history above the final reply, preserving interactive content and original message identities.
- ee6fc28: Show persisted root execution duration in process disclosures and localized updatedAt timestamps beneath assistant and human messages on message hover or focus. Keep the latest assistant reply's action buttons visible. Preserve server timestamps across streaming and history hydration, including root timing in branched history snapshots.

  Include a localized relative day for recent past messages and a calendar date for older messages, while keeping today's timestamps compact.

## 0.6.0

### Minor Changes

- 54f4adf: Add opt-in composer.resources with plugin, middleware and published expert selection, revisioned conversation persistence, workspace connections and searchable responsive resource details. Requires @xpert-ai/xpert-sdk ^0.3.0 for runtime resource methods.
- 54f4adf: Add composer.resources.onConnect to open workspace Connector configuration directly in the host. Forward Assistant and binding identities through the iframe bridge, show the action only with workspace configuration permission, and verify connection readiness before adding capabilities. Credentials and OAuth remain in the host; cancellation leaves the selection unchanged.

### Patch Changes

- 54f4adf: Mark `ChatKitOptions.composer.connectors` as deprecated in favor of unified resource selection through `composer.resources`. Runtime behavior is unchanged; the legacy option still controls native Connector capabilities until migration is complete.
- 54f4adf: Support I18nObject resource descriptions in information cards, details, and cached resource search. Render translations using the current locale and shared fallback rules, including legacy expert descriptions stored as JSON strings. Keep ordinary descriptions as plain text.

## 0.5.10

### Patch Changes

- ba90709: external assistant

## 0.5.9

### Patch Changes

- 5e73eed: Add compact starter-question lists below the composer with send and edit actions, visible only before the conversation starts. Keep slash-command suggestions adjacent to the input.
- ed12227: Add typed prompt scenarios. Insert editable prompt drafts, replace scenario arguments while preserving body edits, and keep selected skill and agent chips aligned with submitted capabilities. Render agent selections with compact muted labels and truncated long names.
- 38025dc: Add optional validated approval display metadata with localized titles, summaries, text, code and table sections. Render plugin-provided content generically and collapse raw action arguments into technical details. Preserve legacy reviews and approval decisions without domain-specific tool checks.

## 0.5.8

### Patch Changes

- 055a70d: Preserve the effective model window in context usage events and use it for the context occupancy indicator. Continue using the assistant window for older events without model information.
- 16c8e04: Export the shared ContextCompressionReason type and reuse it in the context-compression renderer without changing reason codes or display behavior.

## 0.5.7

### Patch Changes

- 0e9ad06: Allow hosts to disable Project creation independently from Project selection.

## 0.5.6

### Patch Changes

- 3a7225d: Add opt-in Xpert Project selection and conversation-level Connector binding selection. Project scope is locked after the first send, scoped resources reset when the Project changes, and public Project and Connector change events are available in every framework wrapper.

## 0.5.5

### Patch Changes

- c3d57a3: Add hosted Assistant model discovery, provider avatars, model preference persistence, a compact composer picker, and model-aware send, queue, and retry behavior. Align the web-component source baseline with the already published 0.5.2 release before applying this patch changeset.

## 0.5.4

### Patch Changes

- a086772: side chat

## 0.5.3

### Patch Changes

- 75c95ef: Render tagged MCP boolean Elicitation interrupts as required True or False fields instead of generic action-review arguments.

## 0.5.2

### Patch Changes

- 2ca5cd6: Use the Xpert SDK for MCP App runtime requests and add isolated sandbox, approval, teardown, display mode, message, and download support.

## 0.5.1

### Patch Changes

- d6a31c8: Add projectId
- f92b405: tool icon

## 0.5.0

### Minor Changes

- cfae5c6: Add a secure Tool Output Attachment protocol for immutable model-viewed images,
  host-authorized short-lived preview resolution, inline tool-call galleries, and
  accessible full-image previews without persisting signed URLs or base64 data.

## 0.4.7

### Patch Changes

- 4610ece: Add an opt-in Remote Views workbench with responsive split and drawer layouts,
  an isolated iframe protocol bridge, chat context and client-command integration,
  and the public `workbench` options.

## 0.4.6

### Patch Changes

- 8d8b8b4: Add the opt-in task summary contribution protocol, resource effects, history aggregation, and responsive six-section task summary interface.

## 0.4.5

### Patch Changes

- d6b2e09: feat: set runtime capabilities

## 0.4.4

### Patch Changes

- 3830e6f: message navigation

## 0.4.3

### Patch Changes

- eb343de: add file types

## 0.4.2

### Patch Changes

- 8a8b98d: maxWidth of layout

## 0.4.1

### Patch Changes

- 9fe05aa: support mcp tool result

## 0.4.0

### Minor Changes

- 2c299ff: mcp apps

## 0.3.13

### Patch Changes

- ac09330: Preserve thread goal specs in parsed goal payloads.

## 0.3.12

### Patch Changes

- 46c1eb6: Gate the goal composer switch by selected runtime plugins and allow client actions to carry runtime capability metadata.

## 0.3.11

### Patch Changes

- 4eb160f: add conversation goal controls and thread goal event types
- 619739d: paging messages & goal

## 0.3.10

### Patch Changes

- a369072: new composer attachments

## 0.3.9

### Patch Changes

- 991df74: Support flat A2UI widget messages while preserving legacy pre-resolved surface rendering.

## 0.3.8

### Patch Changes

- 4f3255c: slash command label i18n

## 0.3.7

### Patch Changes

- 9423ff7: compress slash command

## 0.3.6

### Patch Changes

- 3ac697b: sub-agent component group

## 0.3.5

### Patch Changes

- e2f3141: browser automation tools

## 0.3.4

### Patch Changes

- 639ef79: browser automation extension

## 0.3.3

### Patch Changes

- browser automation extension

## 0.3.2

### Patch Changes

- 7f60e3c: pet & browser extension & host automation

## 0.3.1

### Patch Changes

- ec68d2b: Expose runtime constants from a dedicated `./constants` subpath with ESM and CJS entry points.

## 0.2.3

### Patch Changes

- 5c0cab1: sub-agents selection
- 96aac52: Add ChatKit runtime sub-agent selection.

## 0.2.2

### Patch Changes

- 361c358: skills & middlewares selection

## 0.2.1

### Patch Changes

- 17eaff4: plan mode's plan card

## 0.2.0

### Minor Changes

- e598ceb: plan mode

## 0.1.1

### Patch Changes

- cf1a173: refenerces

## 0.1.0

### Minor Changes

- 10c8af9: Minor release v0.1

## 0.0.17

### Patch Changes

- 6ac204e: org id and secret

## 0.0.16

### Patch Changes

- 7d74063: secret and organization id

## 0.0.15

### Patch Changes

- fb7f719: Move env to context param

## 0.0.14

### Patch Changes

- a11dc53: chatkit request options

## 0.0.13

### Patch Changes

- c93a4b4: thread context usage
