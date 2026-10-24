# Content editors in ChatKit Workbench

ChatKit owns document navigation and review. Embedders supply authentication and a public entry URL; they do not implement or forward `workbench.content.*` or `assistant.content.review`.

## Dependency prerequisite

This source change requires the SDK `Client.content` API and the optional `XpertViewClientCommandDefinition.required` field. The declared SDK 0.14.0 does not provide them yet. For review, build the sibling `xpert-sdk/packages/core` and temporarily link it into `packages/chatkit-ui/node_modules/@xpert-ai/xpert-sdk`. Restore the original link after checking. Manifests and lockfiles deliberately retain their published dependencies. Publish the SDK before updating the formal dependency and releasing ChatKit; this is not a deployable release with the old dependency.

## Embedder contract

```ts
const options = {
  workbench: {
    enabled: true,
    linkBaseUrl: 'https://example.test/chat/x/assistant/p/{projectId}/c',
  },
};
// Before removing/rebinding the mounted ChatKit:
if (await chatkit.prepareLeave().catch(() => false)) {
  // Continue the host application's navigation.
}
```

`prepareLeave()` is a generic, asynchronous lifecycle handshake. A false result or rejection keeps the mounted client alive. ChatKit handles its own thread/options transitions and dirty-editor browser unload prompts. An embedder must use the handshake for its own routes before removing the element; it cannot unmount first and then ask to save. The method is exposed by the web component and Angular, React, Vue and UI5 controls.

`prepareLeave()` is the public leave contract; `dirty` remains internal. The editor coordinator derives one read-only dirty snapshot for native tab indicators, unload prompts and save checks. The host does not subscribe to or cache a second dirty flag. If a host later needs an unsaved indicator, a read-only notification can be added without making it a navigation permission. A true result covers editor persistence at the completed check, not AI task completion, and does not perform navigation or discard edits.

`linkBaseUrl` must be a public HTTP(S) entry address for the active Assistant. `{projectId}` is replaced with the trusted project. Resource links remove existing query/hash data and add the resolved view, resource, provider and optional block anchor. Missing configuration returns `link_unavailable`.

## Remote View commands

Declare each command in the manifest. Mark runtime prerequisites with `required: true`, so containers that do not implement them can omit the view without plugin-name checks. This flag does not grant permissions.

| Command                           | Payload                                | Responsibility                                                                                      |
| --------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `workbench.content.resolve`       | `{resourceId, providerKey?}`           | SDK authorization and editor discovery; returns navigation without opening or saving                |
| `workbench.navigation.open`       | returned navigation                    | Opens the resolved view within this Workbench; saves the target's dirty resource before replacement |
| `workbench.content.status`        | `{resourceId, dirty, title?}`          | Current remote editor state and document name; consumed by its frame adapter                        |
| `workbench.content.close`         | `{}`                                   | Saves the calling editor, replies, then closes its tab                                              |
| `workbench.content.link/copyLink` | `{resourceId, providerKey?, blockId?}` | Authorized public resource links                                                                    |
| `assistant.content.review`        | `{resourceId, blockId?}`               | ChatKit review UI and existing Assistant message flow                                               |

Content commands never fall through to `onClientCommand`. The removed `workbench.content.open` command returns unsupported. Standard view navigation also stays local. Cross-Assistant/Project commands still use existing authorized navigation and pass through the leave gate.

The SDK uses `/ai/assistants/:assistantId/projects/:projectId/content/:resourceId/*`. Trusted scope is supplied by the Workbench, never by the plugin payload. Providers enforce authorization at each API operation. Reviews currently use the platform text-document model; generic editor discovery is separate and does not promise text review for every file format.

## Save lifecycle

Each Workbench owns one `EditorLifecycle`, shared by native and remote editors. A remote view declaring `workbench.content.status` registers only within its mounted frame. Status and acknowledgments must match the current iframe window, instance, scope revision and resource identity.

Report `title` as the current resource's plain-text name on load, rename and every status update. It is separate from a save-status label. Editor tabs show this name (with truncation and a full-name tooltip), falling back to the manifest label when absent. A theme-colored dot with a localized “Unsaved changes” label comes from the same coordinator used for leave protection; keep `dirty: true` until persistence succeeds. The view picker continues to show the manifest's editor type. Metadata is cleared on frame disposal and cannot carry over to another resource or Workbench.

When leaving a dirty editor, ChatKit sends `type: 'editorEvent', kind: 'prepareClose', requestId, resourceId, scopeRevision`. The plugin must flush edits, report clean status, then respond with `type: 'closePrepared', requestId, scopeRevision, ready: true`. A stale acknowledgment, ten-second timeout, false result, still-dirty state or disposed frame blocks the transition. Clean tabs close synchronously. A pending close cannot change the selection of a tab the user selected meanwhile.

The review dialog supports proposal decisions, comments, revision preview/restore and external-file reconciliation. It aborts requests on unmount, prevents stale-context results from opening UI, and preserves the backend's epoch/sequence/hash requirements. Ask-Assistant uses the existing Assistant message command, not a plugin-owned AI session.

## Checks

With the local SDK linked:

```sh
corepack pnpm --filter @xpert-ai/chatkit-ui types
corepack pnpm --filter @xpert-ai/chatkit-ui exec vitest run src/workbench src/providers/ParentMessenger.test.tsx
```

Focused contracts are covered in `workbench/content`, `workbench/editors`, `WorkbenchShell.content.test.tsx`, `RemoteViewFrame.test.tsx` and `ParentMessenger.test.tsx`. Release requires the SDK dependency update and normal project CI/build checks; local test success alone is not a release approval.
