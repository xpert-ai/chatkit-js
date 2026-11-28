---
'@xpert-ai/chatkit-ui': minor
---

Add task/output and more-action menus to side chats, along with shared Workbench tab context menus for closing the current, other, right-hand or all tabs while respecting editor close guards. Use a distinct side-chat icon and stable numbered default titles based on the main conversation.

Support archiving, restoring and permanently deleting side chats from their menus. Archived chats remain accessible in the task summary, and deletion requires confirmation with retryable errors. These operations require matching platform support for side-chat archive metadata and deletion of editing branches.

Show only the side chat's own messages while retaining inherited conversation context for the assistant. Remove the empty side-chat placeholder and correct rename-dialog spacing, alignment and focus-ring clipping across themes and viewport sizes.
