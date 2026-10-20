---
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-types': patch
---

Preserve rejected send errors and restore drafts, refresh invalid model selections, and require an explicit available model before retrying. Clear disconnect errors only after verifying the acknowledged run succeeded; keep unconfirmed sends visible to avoid duplicate retries.
