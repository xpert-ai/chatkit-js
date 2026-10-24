---
'@xpert-ai/chatkit-types': minor
'@xpert-ai/chatkit-ui': minor
'@xpert-ai/chatkit-web-component': minor
---

Add host-controlled Workbench View navigation and an onNavigationChange bridge. Routed embedders can restore the selected Project, View and query after refresh or browser history navigation while keeping same-scope Remote Views mounted. Disable iframe-owned history when the embedder controls navigation, and accept completed host Project navigation only within the original Assistant and organization.

Forward unsupported legacy View navigation to the authorized host when the host owns navigation. Remote iframe Views use ChatKit by default without adding plugin presentation settings.
