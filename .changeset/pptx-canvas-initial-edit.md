---
'@xpert-ai/chatkit-ui': patch
---

Keep text editing active when a PPTX canvas receives input immediately after loading. Scope transient canvas state to each slide so switching slides resets editing and drag state without a delayed mount effect clearing the first edit.
