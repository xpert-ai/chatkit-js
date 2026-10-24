---
'@xpert-ai/chatkit-ui': minor
'@xpert-ai/chatkit-types': minor
'@xpert-ai/chatkit-web-shared': minor
'@xpert-ai/chatkit-web-component': minor
'@xpert-ai/chatkit-angular': minor
'@xpert-ai/chatkit-react': minor
'@xpert-ai/chatkit-vue': minor
'@xpert-ai/chatkit-ui5': minor
---

Handle content editor discovery, document navigation, resource links, and content review inside ChatKit Workbench. Review supports proposals, comments, revision restoration, and external-file reconciliation through the Xpert SDK.

Expose `prepareLeave()` through the web component and framework integrations so embedding applications can wait for pending editor saves before navigating or unmounting. Native and remote editors share leave protection, and remote editor tabs display the current document name and an unsaved-changes indicator.

Remote views must declare their content commands. `workbench.content.*` and `assistant.content.review` are handled locally without falling through to embedder callbacks; use `workbench.content.resolve` followed by `workbench.navigation.open` instead of the removed `workbench.content.open` command. Configure `workbench.linkBaseUrl` for public resource links.

Release prerequisite: publish and adopt an Xpert SDK version providing `Client.content` and required view-command declarations before releasing this change. The currently declared SDK 0.14.0 does not provide these APIs; local integration uses the unpublished SDK until the formal dependency is updated.
