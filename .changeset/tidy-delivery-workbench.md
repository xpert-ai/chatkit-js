---
'@xpert-ai/chatkit-ui': patch
---

Open presented file artifacts in Workbench before falling back to the host. Preserve the delivered version for preview and download, and offer a separate authorized workspace editor with existing draft and conflict protection. Add read-only Office previews alongside Markdown, images, PDF, and text.

Use Tiptap for Markdown editing and read-only display. Open writable Markdown deliveries directly in their workspace editor, require explicit server file capabilities, and recheck write permission before saving.

Update `@xpert-ai/xpert-sdk` to `^0.9.2` and use its workspace file capabilities contract. Missing server capabilities continue to mean read-only access.
