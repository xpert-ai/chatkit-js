---
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-types': patch
---

Recover group sends that require a Project by preserving the draft, guiding project creation or selection using the primary Assistant's project capabilities, and resuming the original send after binding succeeds. Keep group projects independent by default, require explicit consent for reuse, and fix scrolling in the group member picker.

Export the typed `GROUP_PROJECT_REQUIRED` error contract and update ChatKit UI to `@xpert-ai/xpert-sdk` 0.20.3 for published project type and reuse discovery support.
