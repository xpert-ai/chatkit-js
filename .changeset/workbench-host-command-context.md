---
'@xpert-ai/chatkit-types': patch
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-web-component': patch
---

Carry the shell's transient user activation snapshot through the Workbench host command bridge, independently of plugin payloads. Keep command policy and payload validation with host implementations, and discard forwarded results when the originating Workbench context has changed.
