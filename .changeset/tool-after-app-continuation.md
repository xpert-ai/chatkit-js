---
'@xpert-ai/chatkit-ui': patch
---

Support tool-after interrupt continuation from MCP Apps and a Continue panel for tools without an App. Preserve image, audio, and file attachments during resume, and acknowledge continuation only after the server accepts the run. Server run acceptance requires a Content-Location response header exposed through CORS.
