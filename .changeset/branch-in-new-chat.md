---
'@xpert-ai/chatkit-types': patch
'@xpert-ai/chatkit-ui': patch
---

Add a direct Branch in new chat action and tooltips for message action buttons to completed assistant messages that advertise a sealed server checkpoint. Requires Xpert SDK 0.4.0 and the conversation branching backend migration. Preserve source drafts on failure, deduplicate retries, and ignore responses after navigation. Historical app results are displayed without reconnecting to source executions.
