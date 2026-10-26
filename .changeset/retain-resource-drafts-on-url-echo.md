---
'@xpert-ai/chatkit-ui': patch
---

Keep a mounted content editor's unsaved draft when the embedding host echoes its
current resource URL. Only replacement or explicit reload invokes the save gate;
switching resource tabs does not require discarding or saving another tab.
