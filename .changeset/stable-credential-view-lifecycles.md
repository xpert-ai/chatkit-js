---
'@xpert-ai/chatkit-ui': patch
---

Preserve history callbacks and mounted views when client credentials first become
available or rotate, while still resetting the session when credentials are
cleared or the organization changes. Avoid redundant remote-view initialization
after context validation, without suppressing theme or navigation updates. Run
SDK routing tests with matching native Fetch and Blob implementations on Node 24.
