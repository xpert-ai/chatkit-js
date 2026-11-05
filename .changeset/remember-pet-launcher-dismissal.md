---
'@xpert-ai/chatkit-types': patch
'@xpert-ai/chatkit-ui': patch
'@xpert-ai/chatkit-web-component': patch
'@xpert-ai/chatkit-angular': patch
'@xpert-ai/chatkit-js': patch
'@xpert-ai/chatkit-react': patch
'@xpert-ai/chatkit-ui5': patch
'@xpert-ai/chatkit-vue': patch
'@xpert-ai/chatkit-vue2': patch
---

In pet display mode the launcher starts visible by default. Passing `pet.enabled: false` or `pet: false` now collapses it to Show pet. Hosts can remember the user's choice by handling the launcher visibility event and updating `pet.enabled`.
