---
'@xpert-ai/chatkit-ui': patch
---

Add durable pause and resume for live agent runs, and let users edit a sent question to fork a new working branch. Upgrade `@xpert-ai/xpert-sdk` to `^0.2.1` for thread copy, pause snapshots, and run control.

Show a pause control once a run id exists, freeze the paused transcript from the server snapshot, and keep completed tool cards from looking like they are still running. Resume continues the same execution instead of stopping the stream.

Replace a human message in place, copy the thread before that message, and submit the edited text on the new branch. Unlock pause as soon as generation starts after the fork so the new run can be paused like a normal send. Ignore finished history execution ids on idle threads so the pause control does not target a stale run.
