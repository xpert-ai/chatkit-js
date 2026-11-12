---
'@xpert-ai/chatkit-ui': patch
---

Show group resource navigation as a single card with a title, resource context and an explicit Open action. Reuse the resource-card layout, remove the exact generated title fallback, and keep additional message text, history replay behavior and current-group authorization unchanged.

Render provider-declared resource type icons through the shared icon renderer, with a generic fallback for older links.
