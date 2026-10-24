---
'@xpert-ai/chatkit-ui': patch
---

Notify retained Workbench views of their visibility so hidden views can pause polling without losing local state. Pause external Assistant status polling in hidden browser tabs and refresh when visible again.

Use the SDK's compact run-status endpoint when available, retain compatibility with older SDKs and servers, and preserve existing Assistant presentation and timing fields when merging partial status updates.
