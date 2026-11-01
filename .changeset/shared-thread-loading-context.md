---
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-types': patch
---

Reuse authorized conversation metadata and the initial thread control snapshot across history, title, project and resource consumers. Reveal history before background run recovery completes, avoid rereading unchanged completed-run messages, and load auxiliary summaries and resource commands only when needed with scoped short-lived caches. Include lightweight conversation context in `thread.load.end`, with compatibility for older servers and hosts.
