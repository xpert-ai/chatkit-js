---
'@xpert-ai/chatkit-ui': patch
---

Show Assistant template components as sub-agents in plugin information and details, with one add/remove action for the whole package. Preserve existing connector authorization and resource selection behavior.

Requires the matching Xpert API and the SDK release containing assistant_template catalog components. Update the SDK dependency and lockfile to that release before publishing ChatKit; cross-repository development validation uses an isolated build of the matching SDK.
