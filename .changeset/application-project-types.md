---
'@xpert-ai/chatkit-ui': minor
---

Filter and paginate Projects by application/type, use Assistant-declared defaults, and route entity Project creation to the application's workflow. Upgrade `@xpert-ai/xpert-sdk` to `^0.2.0` and use its released project type APIs, removing the temporary SDK patch.

Group the selector by stable application/type keys with one clickable heading per type. Append pages of 20 without repeating headings, retain loaded choices on retry, and offer a recently updated view using the server's deterministic ordering.

Remove folder icons from Project rows and clear active type filters through the filter icon. Preserve the mounted list and its viewport during filtering, empty results and view changes to prevent the popover from flashing or collapsing.
