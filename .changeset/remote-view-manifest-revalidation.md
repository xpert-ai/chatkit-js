---
'@xpert-ai/chatkit-ui': patch
---

Revalidate remote Workbench View manifests before loading HTML so newly deployed views use current action and file-access permissions. Stop loading unavailable views and avoid restarting active or pending loads when discovery returns an identical manifest.
