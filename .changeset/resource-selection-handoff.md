---
'@xpert-ai/chatkit-ui': patch
---

Keep conversation resource selections through first-message creation and failed-send rollback. Persist the initial selection before starting execution and send its committed revision in both input and injected state. Coordinate resource info cards with one active card and cancellable hover/focus timers.
