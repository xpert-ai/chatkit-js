---
'@xpert-ai/chatkit-ui': patch
---

Use the published Xpert SDK 0.3.0. Block resource edits after failed conversation reads until a successful retry restores the server revision. Resolve selected resource versions independently of catalog search and pagination, revalidate older selections without upgrading them, and distinguish checking, temporary failures and unavailable resources. Invalidate availability caches when returning from workspace management.
