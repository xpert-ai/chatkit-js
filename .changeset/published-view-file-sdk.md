---
'@xpert-ai/chatkit-ui': patch
---

Use the published `@xpert-ai/xpert-sdk` 0.8.0 release for authenticated workspace
file reads and snapshot-free pause requests. Remove the temporary SDK patch and
its dependency configuration. Keep file previews and downloads working in
isolated Workbench views through the trusted host's SDK transport.
