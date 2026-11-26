---
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-types': patch
---

Unify the Workbench side-chat list, creation, status and rename controls in the task summary panel and remove the separate header button. Opening or creating a chat closes the summary popover and activates its Workbench tab; docked summaries remain available. Keep the New View entry and default to the unified summary for side-chat-enabled hosts unless explicitly disabled.

Use compact summary rows with a persistent chat icon, trailing status indicator and collapse/reopen action. Highlight the whole row, keep rename in the context menu and F2 shortcut, and use the same adjacent-tab selection when collapsing from the summary or the tab strip. Collapsing retains the thread and draft; it does not archive the conversation.
