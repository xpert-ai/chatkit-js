# @xpert-ai/chatkit-web-component

## 0.12.1

### Patch Changes

- @xpert-ai/chatkit-types@0.12.1
- @xpert-ai/chatkit-web-shared@0.12.1

## 0.12.0

### Minor Changes

- 3d8d526: Add the public `focusMessage` control for authorized exact-thread message navigation. ChatKit loads missing history, scrolls and highlights the target, and acknowledges success or a specific failure. Workbench navigation accepts message anchors and preserves its source view without sending messages or cancelling runs. Parent message handlers cleanly reject stale, unavailable and failed targets; old navigation payloads remain supported.

### Patch Changes

- Updated dependencies [3d8d526]
  - @xpert-ai/chatkit-types@0.12.0
  - @xpert-ai/chatkit-web-shared@0.12.0

## 0.11.2

### Patch Changes

- @xpert-ai/chatkit-types@0.11.2
- @xpert-ai/chatkit-web-shared@0.11.2

## 0.11.1

### Patch Changes

- @xpert-ai/chatkit-types@0.11.1
- @xpert-ai/chatkit-web-shared@0.11.1

## 0.11.0

### Minor Changes

- 6c68e83: Add an optional realtime voice host bridge, dialing in the assistant appearance
  dialog, persistent call controls above the dialog, and durable Call ended timeline
  receipts with duration. Float the panels inside the chat viewport and retain mute
  and hangup controls when the appearance dialog closes.

### Patch Changes

- Updated dependencies [6c68e83]
  - @xpert-ai/chatkit-types@0.11.0
  - @xpert-ai/chatkit-web-shared@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [2875454]
  - @xpert-ai/chatkit-types@0.10.0
  - @xpert-ai/chatkit-web-shared@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [6b230fb]
- Updated dependencies [8c4adb8]
- Updated dependencies [4051e5f]
  - @xpert-ai/chatkit-types@0.9.0
  - @xpert-ai/chatkit-web-shared@0.9.0

## 0.8.0

### Patch Changes

- @xpert-ai/chatkit-types@0.8.0
- @xpert-ai/chatkit-web-shared@0.8.0

## 0.7.0

### Minor Changes

- 2fc0cd2: Add optional inline HITL approval cards anchored to the relevant Assistant tool
  call. Expose generic host decision and settings callbacks through ChatKit options
  and the Web Component bridge. Host-backed requests require acknowledgement before
  resuming, with expiry, duplicate-submission and stale-thread protections. Preserve
  the existing review panel for complex decisions and keep resource authorization
  and native execution in the host.
- 1159f04: Add opt-in `header.windowDrag` for Electron hosts. Chat and Workbench header whitespace supports native dragging and the OS title-bar double-click action. Interactive controls are excluded, and menus/dialogs suspend native hit regions.
- eb210a6: Align all ChatKit workspace packages on a shared release version. Start from the
  0.6.3 baseline and release 0.7.0 together, including framework adapters, widgets,
  host automation, browser tooling, and Office/WPS add-ins. Keep future releases
  synchronized through a fixed Changesets group; private packages remain private.

### Patch Changes

- Updated dependencies [02959f7]
- Updated dependencies [2fc0cd2]
- Updated dependencies [1159f04]
- Updated dependencies [eb210a6]
  - @xpert-ai/chatkit-types@0.7.0
  - @xpert-ai/chatkit-web-shared@0.7.0

## 0.6.0

### Minor Changes

- 54f4adf: Add composer.resources.onConnect to open workspace Connector configuration directly in the host. Forward Assistant and binding identities through the iframe bridge, show the action only with workspace configuration permission, and verify connection readiness before adding capabilities. Credentials and OAuth remain in the host; cancellation leaves the selection unchanged.

### Patch Changes

- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
  - @xpert-ai/chatkit-types@0.6.0
  - @xpert-ai/chatkit-web-shared@0.4.5

## 0.5.4

### Patch Changes

- 3a7225d: Add opt-in Xpert Project selection and conversation-level Connector binding selection. Project scope is locked after the first send, scoped resources reset when the Project changes, and public Project and Connector change events are available in every framework wrapper.
- Updated dependencies [3a7225d]
  - @xpert-ai/chatkit-types@0.5.6
  - @xpert-ai/chatkit-web-shared@0.4.4

## 0.5.3

### Patch Changes

- c3d57a3: Add hosted Assistant model discovery, provider avatars, model preference persistence, a compact composer picker, and model-aware send, queue, and retry behavior. Align the web-component source baseline with the already published 0.5.2 release before applying this patch changeset.
- Updated dependencies [c3d57a3]
  - @xpert-ai/chatkit-types@0.5.5

## 0.5.2

### Patch Changes

- b3d3d74: Keep draggable pets attached to the active pointer during fast movement and clean up safely when pointer capture is lost.

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

## 0.4.1

### Patch Changes

- 4610ece: Add an opt-in Remote Views workbench with responsive split and drawer layouts,
  an isolated iframe protocol bridge, chat context and client-command integration,
  and the public `workbench` options.
- Updated dependencies [4610ece]
  - @xpert-ai/chatkit-types@0.4.7

## 0.4.0

### Minor Changes

- d6b2e09: feat: set runtime capabilities

### Patch Changes

- Updated dependencies [d6b2e09]
  - @xpert-ai/chatkit-web-shared@0.4.0
  - @xpert-ai/chatkit-types@0.4.5

## 0.3.6

### Patch Changes

- Updated dependencies [2c299ff]
  - @xpert-ai/chatkit-types@0.4.0
  - @xpert-ai/chatkit-web-shared@0.3.4

## 0.3.5

### Patch Changes

- 21d6bd5: pet overlay loading & theme

## 0.3.4

### Patch Changes

- 5855944: minimize to pet

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

## 0.3.0

### Minor Changes

- pet & plugins & skills & prompts

### Patch Changes

- Updated dependencies [5c0cab1]
- Updated dependencies [f594038]
- Updated dependencies [361c358]
- Updated dependencies
- Updated dependencies [96aac52]
- Updated dependencies [169d5d5]
  - @xpert-ai/chatkit-types@0.3.0
  - @xpert-ai/chatkit-web-shared@0.2.0

## 0.2.1

### Patch Changes

- 811dddc: web component import
- Updated dependencies [811dddc]
  - @xpert-ai/chatkit-web-shared@0.1.1

## 0.2.0

### Minor Changes

- e598ceb: plan mode

### Patch Changes

- Updated dependencies [e598ceb]
  - @xpert-ai/chatkit-types@0.2.0

## 0.1.0

### Minor Changes

- 10c8af9: Minor release v0.1

### Patch Changes

- Updated dependencies [10c8af9]
  - @xpert-ai/chatkit-web-shared@0.1.0
  - @xpert-ai/chatkit-types@0.1.0
