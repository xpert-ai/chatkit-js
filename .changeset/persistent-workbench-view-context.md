---
'@xpert-ai/chatkit-ui': patch
---

Preserve mounted Assistant Workbench views when switching conversations or projects, revalidate access in the target context, and notify retained views through `view.context.changed`. Cancel obsolete requests and file-access sessions, and prevent late navigation results from affecting the new context. Reset chat state and the composer on project changes without recreating the Workbench views.
