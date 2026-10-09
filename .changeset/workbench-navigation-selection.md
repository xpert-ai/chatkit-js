---
'@xpert-ai/chatkit-ui': patch
---

Restore an explicitly requested View query after conversation navigation with preserveView enabled, once the destination scope confirms that the View is available. Preserve existing queries when no query is supplied within the same scope, while retaining the normal query reset across scopes.
