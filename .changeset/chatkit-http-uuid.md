---
'@xpert-ai/chatkit-web-shared': patch
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-host-automation': patch
'@xpert-ai/chatkit-browser-extension': patch
---

Fix blank ChatKit Workbench panels on non-loopback HTTP origins by centralizing browser UUID generation with a cryptographically secure UUID v4 fallback. Reuse the helper for previews, group conversations, messaging and browser automation, and fail closed when no secure random source exists. Add browser regression coverage for HTTP, localhost, HTTPS and embedded panels.
