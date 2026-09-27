---
'@xpert-ai/chatkit-types': patch
'@xpert-ai/chatkit-ui': patch
---

Distinguish automatic project creation, no project, and an existing project in composer options, project change events, and chat requests. Respect explicit selections across rerenders and keep the bound conversation project visible and locked. Restore the saved project for historical conversations and synchronize project names and file browsing after automatic creation without interrupting an active run or clearing the draft.
