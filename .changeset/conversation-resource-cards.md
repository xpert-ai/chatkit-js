---
'@xpert-ai/chatkit-types': patch
'@xpert-ai/chatkit-ui': patch
---

Add validated persisted Resource Card message parts and a reply-bottom card renderer with explicit Workbench navigation. Repeated resources update within one reply, remain independent across replies, and do not enter transcript/model text. Explicit task-card navigation supports selection restoration, history and refresh. The host command request carries the persisted card identity for authorization.

Resource Cards appear together with file review receipts only after their Assistant reply stops streaming. Incoming cards remain in message state for completion, interruption and history recovery without mounting the card UI during output.
