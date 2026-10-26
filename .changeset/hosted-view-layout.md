---
'@xpert-ai/chatkit-types': patch
'@xpert-ai/chatkit-ui': patch
---

Allow routed Workbench Views to request a maximized or split layout. Apply it only after the destination is authorized and pending editor saves succeed, and report manual layout changes through the existing navigation callback without remounting the View.
