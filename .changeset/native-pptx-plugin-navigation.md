---
'@xpert-ai/chatkit-ui': minor
---

Open Project PPTX files through the registered file editor and retire the embedded writable PPTX editor. Keep ordinary native file routing and ignore editor-resolution results from a previous Project context.

Requires the matching Xpert server and PPTX Editor plugin. Upgrade the browser SDK dependency to `^0.27.0`, which provides `ContentClient.resolveFile`. Non-Project PPTX editing now directs users to the Project plugin workflow.
