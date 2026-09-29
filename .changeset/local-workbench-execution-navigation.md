---
'@xpert-ai/chatkit-ui': patch
---

Open execution records requested by Workbench views inside the current ChatKit conversation before asking the host to navigate. Preserve the composer and active thread, load older records through SDK pagination, and allow closed execution panels to reopen. Return unavailable or stale-scope errors without a redundant host navigation, while retaining compatibility with existing conversation navigation commands.
