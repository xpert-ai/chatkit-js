# @xpert-ai/chatkit-ui

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
