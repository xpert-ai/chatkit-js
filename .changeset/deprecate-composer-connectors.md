---
'@xpert-ai/chatkit-types': patch
---

Mark `ChatKitOptions.composer.connectors` as deprecated in favor of unified resource selection through `composer.resources`. Runtime behavior is unchanged; the legacy option still controls native Connector capabilities until migration is complete.
