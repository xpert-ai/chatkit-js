# @xpert-ai/chatkit-ui

## 0.6.0

### Minor Changes

- 54f4adf: Resolve Agent Plugin dependencies through workspace-owned Connector settings and cancellable readiness polling. Only workspace administrators configure or reconnect services; chat users select capabilities through their Assistant access. Legacy personal credentials are never reused as shared credentials. Keep credential-only Connectors out of the standalone middleware selector. Requires the SDK release with typed resource authorization and browser callback credentials.
- 54f4adf: Add opt-in composer.resources with plugin, middleware and published expert selection, revisioned conversation persistence, workspace connections and searchable responsive resource details. Requires @xpert-ai/xpert-sdk ^0.3.0 for runtime resource methods.
- 54f4adf: Unify executable Connector capabilities and Agent Plugins under Connect plugins, retaining separate binding identities and conversation persistence. Cache catalogs by client, Assistant and project; use workspace management links and readiness without individual OAuth. Keep the legacy Connector picker for hosts without runtime resources enabled.

### Patch Changes

- 54f4adf: Read workspace connection readiness through the Assistant-scoped SDK runtime API so ChatKit session credentials work without access to administrator OAuth endpoints.
- b0515d3: fix: append the AI response after newer messages instead of reusing a stale empty placeholder left by a failed run
- 54f4adf: Keep conversation resource selections through first-message creation and failed-send rollback. Persist the initial selection before starting execution and send its committed revision in both input and injected state. Coordinate resource info cards with one active card and cancellable hover/focus timers.
- 54f4adf: Support I18nObject resource descriptions in information cards, details, and cached resource search. Render translations using the current locale and shared fallback rules, including legacy expert descriptions stored as JSON strings. Keep ordinary descriptions as plain text.
- 54f4adf: Use the published Xpert SDK 0.3.0. Block resource edits after failed conversation reads until a successful retry restores the server revision. Resolve selected resource versions independently of catalog search and pagination, revalidate older selections without upgrading them, and distinguish checking, temporary failures and unavailable resources. Invalidate availability caches when returning from workspace management.
- 54f4adf: Add composer.resources.onConnect to open workspace Connector configuration directly in the host. Forward Assistant and binding identities through the iframe bridge, show the action only with workspace configuration permission, and verify connection readiness before adding capabilities. Credentials and OAuth remain in the host; cancellation leaves the selection unchanged.
- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
  - @xpert-ai/chatkit-types@0.6.0
  - @xpert-ai/chatkit-web-shared@0.4.5

## 0.5.17

### Patch Changes

- ba90709: external assistant
- Updated dependencies [ba90709]
  - @xpert-ai/chatkit-types@0.5.10

## 0.5.16

### Patch Changes

- ea57948: Add durable pause and resume for live agent runs, and let users edit a sent question to fork a new working branch. Upgrade `@xpert-ai/xpert-sdk` to `^0.2.1` for thread copy, pause snapshots, and run control.

  Show a pause control once a run id exists, freeze the paused transcript from the server snapshot, and keep completed tool cards from looking like they are still running. Resume continues the same execution instead of stopping the stream.

  Replace a human message in place, copy the thread before that message, and submit the edited text on the new branch. Unlock pause as soon as generation starts after the fork so the new run can be paused like a normal send. Ignore finished history execution ids on idle threads so the pause control does not target a stale run.

## 0.5.15

### Patch Changes

- 493fe09: Filter and paginate Projects by application/type, use Assistant-declared defaults, and route entity Project creation to the application's workflow. Upgrade `@xpert-ai/xpert-sdk` to `^0.2.0` and use its released project type APIs, removing the temporary SDK patch.

  Group the selector by stable application/type keys with one clickable heading per type. Append pages of 20 without repeating headings, retain loaded choices on retry, and offer a recently updated view using the server's deterministic ordering.

  Remove folder icons from Project rows and clear active type filters through the filter icon. Preserve the mounted list and its viewport during filtering, empty results and view changes to prevent the popover from flashing or collapsing.

## 0.5.14

### Patch Changes

- 186c432: Preserve the last valid context usage after failed calls with Xpert SDK 0.1.1, keep attachment cards next to the composer, and route pasted non-image files through the existing attachment upload queue.

## 0.5.13

### Patch Changes

- 5e73eed: Add compact starter-question lists below the composer with send and edit actions, visible only before the conversation starts. Keep slash-command suggestions adjacent to the input.
- 777b907: Add a searchable file selector beside the composer project selector. Reference files from the selected project or assistant workspace without changing the message draft, with keyboard selection and project scope changes supported.
- 82c581d: Submit approve or reject immediately for a single human-review action restricted to those decisions. Preserve the existing review flow for multiple actions and editable or response decisions.
- ed12227: Add typed prompt scenarios. Insert editable prompt drafts, replace scenario arguments while preserving body edits, and keep selected skill and agent chips aligned with submitted capabilities. Render agent selections with compact muted labels and truncated long names.
- 2afd6d5: Render reasoning inline with answers in chronological order, group adjacent reasoning blocks, and replace the reasoning and answer tabs with collapsible sections. Expand active reasoning and collapse it when that phase ends; show thinking status while waiting for the first output.
- 38025dc: Add optional validated approval display metadata with localized titles, summaries, text, code and table sections. Render plugin-provided content generically and collapse raw action arguments into technical details. Preserve legacy reviews and approval decisions without domain-specific tool checks.
- 1875094: Track history loading separately from the selected thread, support retrying failed loads, and distinguish empty existing conversations from the new-task screen. Ignore stale history and stream results after thread switches, refresh hosted credentials when needed, and acknowledge host thread-loading commands after history is ready.
- Updated dependencies [5e73eed]
- Updated dependencies [ed12227]
- Updated dependencies [38025dc]
  - @xpert-ai/chatkit-types@0.5.9

## 0.5.12

### Patch Changes

- 055a70d: Preserve the effective model window in context usage events and use it for the context occupancy indicator. Continue using the assistant window for older events without model information.
- 914e916: Display failed context-compression attempts as failures instead of skipped work, and support detailed compression failure reasons from the server. Preserve the skipped label for successful no-op results.
- 16c8e04: Export the shared ContextCompressionReason type and reuse it in the context-compression renderer without changing reason codes or display behavior.
- Updated dependencies [055a70d]
- Updated dependencies [16c8e04]
  - @xpert-ai/chatkit-types@0.5.8

## 0.5.11

### Patch Changes

- 4276463: Deduplicate Task Summary sources with whitespace differences in their IDs, including pasted references and historical entries, while preserving pagination until all source rows are loaded.

## 0.5.10

### Patch Changes

- 0115b5f: Refine ChatKit composer controls and menus for constrained layouts:
  - Position the scroll-to-bottom control above the composer input.
  - Keep secondary composer menus in place with consistent spacing and scrollable capability lists.
  - Keep long project lists scrollable between fixed search and create controls.
  - Restore runtime sub-agent detail previews.

- d0b972b: Switch composer submenus in place on narrow ChatKit surfaces and expand them to the right when enough container space is available.

## 0.5.9

### Patch Changes

- e46af81: Improve ChatKit task continuity and presentation without changing public APIs:
  - Keep Task Summary content accurate by showing only real sub-agent executions and completed, openable outputs; excluding configured-but-unused capabilities from Sources; preserving historical Agent totals; and exposing complete Todo and Running lists with readable status, descriptions, errors, and full-text tooltips.
  - Reconcile the latest persisted assistant message when a response stream ends early, then refresh the historical Task Summary snapshot.
  - Make the composer shorter, constrain wide layouts, and provide consistent horizontal breathing room.
  - Keep dark-mode state and composer surface colors aligned with the active theme.

- 80f5fc6: Remove the powered-by footer and align the composer's bottom spacing with its horizontal inset.

## 0.5.8

### Patch Changes

- 0e9ad06: Allow hosts to disable Project creation independently from Project selection.
- Updated dependencies [0e9ad06]
  - @xpert-ai/chatkit-types@0.5.7

## 0.5.7

### Patch Changes

- 3a7225d: Add opt-in Xpert Project selection and conversation-level Connector binding selection. Project scope is locked after the first send, scoped resources reset when the Project changes, and public Project and Connector change events are available in every framework wrapper.
- Updated dependencies [3a7225d]
  - @xpert-ai/chatkit-types@0.5.6
  - @xpert-ai/chatkit-web-shared@0.4.4

## 0.5.6

### Patch Changes

- c3d57a3: Add hosted Assistant model discovery, provider avatars, model preference persistence, a compact composer picker, and model-aware send, queue, and retry behavior. Align the web-component source baseline with the already published 0.5.2 release before applying this patch changeset.
- Updated dependencies [c3d57a3]
  - @xpert-ai/chatkit-types@0.5.5

## 0.5.5

### Patch Changes

- a086772: side chat
- Updated dependencies [a086772]
  - @xpert-ai/chatkit-types@0.5.4

## 0.5.4

### Patch Changes

- 75c95ef: Render tagged MCP boolean Elicitation interrupts as required True or False fields instead of generic action-review arguments.
- Updated dependencies [75c95ef]
  - @xpert-ai/chatkit-types@0.5.3

## 0.5.3

### Patch Changes

- 2ca5cd6: Use the Xpert SDK for MCP App runtime requests and add isolated sandbox, approval, teardown, display mode, message, and download support.
- Updated dependencies [2ca5cd6]
  - @xpert-ai/chatkit-types@0.5.2

## 0.5.2

### Patch Changes

- d6a31c8: Add projectId
- f92b405: tool icon
- Updated dependencies [d6a31c8]
- Updated dependencies [f92b405]
  - @xpert-ai/chatkit-types@0.5.1

## 0.5.1

### Patch Changes

- 573d1bd: Authenticate iframe messages with a per-frame channel when embedded WebViews expose non-canonical window source proxies.
  Defer composer state synchronization until IME composition ends in embedded WebViews.
- Updated dependencies [573d1bd]
  - @xpert-ai/chatkit-web-shared@0.4.3

## 0.5.0

### Minor Changes

- cfae5c6: Add a secure Tool Output Attachment protocol for immutable model-viewed images,
  host-authorized short-lived preview resolution, inline tool-call galleries, and
  accessible full-image previews without persisting signed URLs or base64 data.

### Patch Changes

- Updated dependencies [cfae5c6]
  - @xpert-ai/chatkit-types@0.5.0
  - @xpert-ai/chatkit-web-shared@0.4.2

## 0.4.12

### Patch Changes

- 1137249: Bind new ChatKit threads to the active assistant before the first run.

## 0.4.11

### Patch Changes

- 4610ece: Add an opt-in Remote Views workbench with responsive split and drawer layouts,
  an isolated iframe protocol bridge, chat context and client-command integration,
  and the public `workbench` options.
- Updated dependencies [4610ece]
  - @xpert-ai/chatkit-types@0.4.7

## 0.4.10

### Patch Changes

- 505b4fb: ui

## 0.4.9

### Patch Changes

- 242cac0: Hide primary agent executions from agent activity.
- 7af926c: Remove inactive output and source action buttons from the task summary.
- 865ec8d: Stop running sub-agent indicators when a chat run is interrupted.
- 47b49d0: Deduplicate human message attachments already displayed as image references.

## 0.4.8

### Patch Changes

- 8d8b8b4: Add the opt-in task summary contribution protocol, resource effects, history aggregation, and responsive six-section task summary interface.
- Updated dependencies [8d8b8b4]
  - @xpert-ai/chatkit-types@0.4.6
  - @xpert-ai/chatkit-web-shared@0.4.1

## 0.4.7

### Patch Changes

- 5bbdf4a: Place inserted runtime capability composer chips before prompt text when both are provided by setComposerValue.
- 21972b6: title of thread
- f20c001: pet avatar
- 5bbdf4a: Render runtime capability chips and selectors with capability metadata colors.

## 0.4.6

### Patch Changes

- d6b2e09: feat: set runtime capabilities
- Updated dependencies [d6b2e09]
  - @xpert-ai/chatkit-web-shared@0.4.0
  - @xpert-ai/chatkit-types@0.4.5

## 0.4.5

### Patch Changes

- 3830e6f: message navigation
- Updated dependencies [3830e6f]
  - @xpert-ai/chatkit-types@0.4.4

## 0.4.4

### Patch Changes

- 79dcf6b: knowledge citation

## 0.4.3

### Patch Changes

- 8a8b98d: maxWidth of layout
- Updated dependencies [8a8b98d]
  - @xpert-ai/chatkit-types@0.4.2

## 0.4.2

### Patch Changes

- c384e60: mcp app instance token

## 0.4.1

### Patch Changes

- 9fe05aa: support mcp tool result
- Updated dependencies [9fe05aa]
  - @xpert-ai/chatkit-types@0.4.1

## 0.4.0

### Minor Changes

- 2c299ff: mcp apps

### Patch Changes

- e27c2a6: Defer context usage loading until the ChatKit client secret is available.
- Updated dependencies [2c299ff]
  - @xpert-ai/chatkit-types@0.4.0
  - @xpert-ai/chatkit-web-shared@0.3.4

## 0.3.21

### Patch Changes

- 10a5127: edit prompts suggestions

## 0.3.20

### Patch Changes

- ac09330: Preserve thread goal specs in parsed goal payloads.
- Updated dependencies [ac09330]
  - @xpert-ai/chatkit-types@0.3.13

## 0.3.19

### Patch Changes

- 0e70773: Fix persisted agent run status and duration rendering in ChatKit history.

## 0.3.18

### Patch Changes

- 95125c0: filter thread usage in sub flow

## 0.3.17

### Patch Changes

- de48fec: Queue busy-run follow-ups by default, let guided follow-ups take priority over queued items, and send queued follow-ups one at a time instead of merging items that target the same execution.

## 0.3.16

### Patch Changes

- 46c1eb6: Gate the goal composer switch by selected runtime plugins and allow client actions to carry runtime capability metadata.
- Updated dependencies [46c1eb6]
  - @xpert-ai/chatkit-types@0.3.12

## 0.3.15

### Patch Changes

- ca6b238: Handle invalid widget surfaces without crashing message rendering.

## 0.3.14

### Patch Changes

- 489a372: middleware chat event

## 0.3.13

### Patch Changes

- 4eb160f: add conversation goal controls and thread goal event types
- 619739d: paging messages & goal
- Updated dependencies [4eb160f]
- Updated dependencies [619739d]
  - @xpert-ai/chatkit-types@0.3.11

## 0.3.12

### Patch Changes

- a369072: new composer attachments
- Updated dependencies [a369072]
  - @xpert-ai/chatkit-types@0.3.10

## 0.3.11

### Patch Changes

- 991df74: Support flat A2UI widget messages while preserving legacy pre-resolved surface rendering.
- Updated dependencies [991df74]
  - @xpert-ai/chatkit-types@0.3.9

## 0.3.10

### Patch Changes

- 21d6bd5: pet overlay loading & theme

## 0.3.9

### Patch Changes

- 4f3255c: slash command label i18n
- Updated dependencies [4f3255c]
  - @xpert-ai/chatkit-types@0.3.8

## 0.3.8

### Patch Changes

- 9423ff7: compress slash command
- Updated dependencies [9423ff7]
  - @xpert-ai/chatkit-types@0.3.7

## 0.3.7

### Patch Changes

- 5855944: minimize to pet
- 49bb2ca: shell tool call component

## 0.3.6

### Patch Changes

- 4703a08: knowledge component

## 0.3.5

### Patch Changes

- 3ac697b: sub-agent component group
- Updated dependencies [3ac697b]
  - @xpert-ai/chatkit-types@0.3.6

## 0.3.4

### Patch Changes

- e2f3141: browser automation tools
- Updated dependencies [e2f3141]
  - @xpert-ai/chatkit-web-shared@0.3.3
  - @xpert-ai/chatkit-types@0.3.5

## 0.3.3

### Patch Changes

- 639ef79: browser automation extension
- Updated dependencies [639ef79]
  - @xpert-ai/chatkit-types@0.3.4

## 0.3.2

### Patch Changes

- browser automation extension
- Updated dependencies
  - @xpert-ai/chatkit-web-shared@0.3.2
  - @xpert-ai/chatkit-types@0.3.3

## 0.3.1

### Patch Changes

- 7f60e3c: pet & browser extension & host automation
- Updated dependencies [7f60e3c]
  - @xpert-ai/chatkit-web-shared@0.3.1
  - @xpert-ai/chatkit-types@0.3.2

## 0.2.5

### Patch Changes

- 8bf0360: Show active sandbox services above the composer and refresh them from runtime tool messages.

## 0.2.4

### Patch Changes

- 5c0cab1: sub-agents selection
- 96aac52: Add ChatKit runtime sub-agent selection.
- Updated dependencies [5c0cab1]
- Updated dependencies [96aac52]
  - @xpert-ai/chatkit-types@0.2.3

## 0.2.3

### Patch Changes

- 361c358: skills & middlewares selection
- 16e8f37: Load runtime capabilities and delete uploaded files through the Xpert SDK client.
- Updated dependencies [361c358]
  - @xpert-ai/chatkit-types@0.2.2

## 0.2.2

### Patch Changes

- 811dddc: web component import
- Updated dependencies [811dddc]
  - @xpert-ai/chatkit-web-shared@0.1.1

## 0.2.1

### Patch Changes

- 17eaff4: plan mode's plan card
- Updated dependencies [17eaff4]
  - @xpert-ai/chatkit-types@0.2.1

## 0.2.0

### Minor Changes

- e598ceb: plan mode

### Patch Changes

- Updated dependencies [e598ceb]
  - @xpert-ai/chatkit-types@0.2.0

## 0.1.2

### Patch Changes

- e6571b2: todos

## 0.1.1

### Patch Changes

- cf1a173: refenerces
- Updated dependencies [cf1a173]
  - @xpert-ai/chatkit-types@0.1.1

## 0.1.0

### Minor Changes

- 10c8af9: Minor release v0.1

### Patch Changes

- Updated dependencies [10c8af9]
  - @xpert-ai/chatkit-web-shared@0.1.0
  - @xpert-ai/chatkit-types@0.1.0
  - @xpert-ai/a2ui-react@0.1.0

## 0.0.20

### Patch Changes

- 6ac204e: org id and secret
- Updated dependencies [6ac204e]
  - @xpert-ai/chatkit-types@0.0.17

## 0.0.19

### Patch Changes

- 7d74063: secret and organization id
- beb9ac4: avatar
- Updated dependencies [7d74063]
  - @xpert-ai/chatkit-types@0.0.16

## 0.0.18

### Patch Changes

- fb7f719: Move env to context param
- Updated dependencies [fb7f719]
  - @xpert-ai/chatkit-types@0.0.15

## 0.0.17

### Patch Changes

- a11dc53: chatkit request options
- Updated dependencies [a11dc53]
  - @xpert-ai/chatkit-types@0.0.14

## 0.0.16

### Patch Changes

- c93a4b4: thread context usage
- Updated dependencies [c93a4b4]
  - @xpert-ai/chatkit-types@0.0.13

## 0.0.15

### Patch Changes

- ca92d3a: Streaming bash

## 0.0.14

### Patch Changes

- e4b85bc: Streaming bash

## 0.0.13

### Patch Changes

- 8de7100: streaming bash

## 0.0.12

### Patch Changes

- fa82b94: streaming bash
