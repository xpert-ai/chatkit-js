---
'@xpert-ai/chatkit-ui': patch
---

Improve ChatKit task continuity and presentation without changing public APIs:

- Keep Task Summary content accurate by showing only real sub-agent executions and completed, openable outputs; excluding configured-but-unused capabilities from Sources; preserving historical Agent totals; and exposing complete Todo and Running lists with readable status, descriptions, errors, and full-text tooltips.
- Reconcile the latest persisted assistant message when a response stream ends early, then refresh the historical Task Summary snapshot.
- Make the composer shorter, constrain wide layouts, and provide consistent horizontal breathing room.
- Keep dark-mode state and composer surface colors aligned with the active theme.
