---
'@xpert-ai/chatkit-ui': patch
---

Show all conversations for the current Assistant by default, with explicit filters for the current project and conversations without a project. Ignore stale history search responses after changing scope. Emit thread load lifecycle events so the host can synchronize the URL and project after a successful history load, without reporting failed or superseded loads as complete.
