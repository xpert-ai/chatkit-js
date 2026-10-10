---
'@xpert-ai/chatkit-ui': patch
---

Handle application project creation inside ChatKit's Workbench. Resolve the creation entry through the SDK and open it in a fresh conversation/project scope instead of delegating a project.create-entry effect to the embedding host. Show failures inline and discard stale or duplicate requests.

Keep the current Assistant profile outside the project-specific chat lifecycle so creating or switching projects does not clear its name, avatar, or published presentation settings or refetch the profile merely because Chat remounts.
