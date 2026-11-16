---
'@xpert-ai/chatkit-ui': patch
---

Keep single-file resource deliveries in a compact horizontal row: a square cover extending below the card on the left, one title and file details in the middle, and open/download actions on the right. Reuse the same thumbnail surface for all file types and declared file icons when no cover is supplied, while preserving the existing row height. Lazy-load previews, release image URLs and retain file actions on preview failure. Preserve distinct file labels, access errors, download retry and existing multi-block cards.

Reuse ChatKit's shared Office file icons when a cover is missing or fails. Resolve MIME metadata through scoped SDK file grants without downloading document bytes, including for historical cards and direct file targets.
