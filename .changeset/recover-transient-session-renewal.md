---
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-web-shared': patch
---

Keep recovery reads retryable when an expired session cannot renew during a temporary network or service outage. Preserve HTTP status and Retry-After across the host frame boundary, share renewal attempts, and retain terminal handling for denied credentials.
