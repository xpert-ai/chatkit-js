---
'@xpert-ai/chatkit-types': minor
'@xpert-ai/chatkit-web-shared': minor
'@xpert-ai/chatkit-web-component': minor
'@xpert-ai/chatkit-angular': minor
'@xpert-ai/chatkit-react': minor
'@xpert-ai/chatkit-js': minor
'@xpert-ai/chatkit-ui': minor
---

Add the public `focusMessage` control for authorized exact-thread message navigation. ChatKit loads missing history, scrolls and highlights the target, and acknowledges success or a specific failure. Workbench navigation accepts message anchors and preserves its source view without sending messages or cancelling runs. Parent message handlers cleanly reject stale, unavailable and failed targets; old navigation payloads remain supported.
