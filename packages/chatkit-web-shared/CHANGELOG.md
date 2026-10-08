# @xpert-ai/chatkit-web-shared

## 0.12.0

### Minor Changes

- 3d8d526: Add the public `focusMessage` control for authorized exact-thread message navigation. ChatKit loads missing history, scrolls and highlights the target, and acknowledges success or a specific failure. Workbench navigation accepts message anchors and preserves its source view without sending messages or cancelling runs. Parent message handlers cleanly reject stale, unavailable and failed targets; old navigation payloads remain supported.

### Patch Changes

- Updated dependencies [3d8d526]
  - @xpert-ai/chatkit-types@0.12.0

## 0.11.2

### Patch Changes

- @xpert-ai/chatkit-types@0.11.2

## 0.11.1

### Patch Changes

- @xpert-ai/chatkit-types@0.11.1

## 0.11.0

### Patch Changes

- Updated dependencies [6c68e83]
  - @xpert-ai/chatkit-types@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [2875454]
  - @xpert-ai/chatkit-types@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [6b230fb]
- Updated dependencies [8c4adb8]
- Updated dependencies [4051e5f]
  - @xpert-ai/chatkit-types@0.9.0

## 0.8.0

### Patch Changes

- @xpert-ai/chatkit-types@0.8.0

## 0.7.0

### Minor Changes

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

## 0.4.5

### Patch Changes

- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
- Updated dependencies [54f4adf]
  - @xpert-ai/chatkit-types@0.6.0

## 0.4.4

### Patch Changes

- 3a7225d: Add opt-in Xpert Project selection and conversation-level Connector binding selection. Project scope is locked after the first send, scoped resources reset when the Project changes, and public Project and Connector change events are available in every framework wrapper.
- Updated dependencies [3a7225d]
  - @xpert-ai/chatkit-types@0.5.6

## 0.4.3

### Patch Changes

- 573d1bd: Authenticate iframe messages with a per-frame channel when embedded WebViews expose non-canonical window source proxies.
  Defer composer state synchronization until IME composition ends in embedded WebViews.

## 0.4.2

### Patch Changes

- Updated dependencies [cfae5c6]
  - @xpert-ai/chatkit-types@0.5.0

## 0.4.1

### Patch Changes

- 8d8b8b4: Add the opt-in task summary contribution protocol, resource effects, history aggregation, and responsive six-section task summary interface.
- Updated dependencies [8d8b8b4]
  - @xpert-ai/chatkit-types@0.4.6

## 0.4.0

### Minor Changes

- d6b2e09: feat: set runtime capabilities

### Patch Changes

- Updated dependencies [d6b2e09]
  - @xpert-ai/chatkit-types@0.4.5

## 0.3.4

### Patch Changes

- Updated dependencies [2c299ff]
  - @xpert-ai/chatkit-types@0.4.0

## 0.3.3

### Patch Changes

- e2f3141: browser automation tools
- Updated dependencies [e2f3141]
  - @xpert-ai/chatkit-types@0.3.5

## 0.3.2

### Patch Changes

- browser automation extension

## 0.3.1

### Patch Changes

- 7f60e3c: pet & browser extension & host automation

## 0.2.0

### Minor Changes

- pet & plugins & skills & prompts

## 0.1.1

### Patch Changes

- 811dddc: web component import

## 0.1.0

### Minor Changes

- 10c8af9: Minor release v0.1
