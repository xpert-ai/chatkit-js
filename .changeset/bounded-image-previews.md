---
'@xpert-ai/chatkit-ui': patch
---

Limit visible image and remote View file reads to four concurrent operations, coalesce identical pending reads, cancel abandoned work, and keep session cleanup off the rendering path. Use single-request thumbnails and explicit original image reads when the host supplies the new Xpert SDK image-preview API; preserve authenticated legacy fallback for older SDKs or servers.

The direct-preview path requires the companion SDK release from xpert-sdk-js (.changeset/authorized-image-previews.md) and the server image-preview endpoint. Update the SDK dependency and lockfile after that release; this change does not publish packages or deploy the server.
