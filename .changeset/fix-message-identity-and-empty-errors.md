---
'@xpert-ai/chatkit-ui': patch
---

Preserve separate assistant messages within the same execution, and route streamed text, components, and replayed updates to the correct message. Keep existing pause and resume behavior compatible.

Hide empty agent errors and let an explicit null clear a previous error while preserving real failures.
