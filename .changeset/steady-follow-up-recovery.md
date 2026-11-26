---
'@xpert-ai/chatkit-ui': patch
---

Prevent duplicate execution of steer follow-ups after stream disconnects or lost acknowledgements. Reconcile persisted receipts across reconnects and paginated history, preserve explicit server queue fallbacks, and ignore stale responses after switching conversations or threads.
