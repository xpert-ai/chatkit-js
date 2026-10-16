---
'@xpert-ai/chatkit-ui': patch
---

Animate newly sent human messages from their composer position into the conversation, blending a subtle elastic shape change into arrival. Keep text and attachments steady while the bubble gently compresses, stretches, and settles without jumping vertically.

Support regular and group chats, preserve draft recovery on failure, and respect reduced-motion preferences. Cancel animations when leaving a conversation and avoid replaying them for history, queued follow-ups, or hidden floating transcripts.

Keep human message bubbles sized to their content when replies reveal message actions and timestamps, preventing extra space after short messages.
