# Remote Views Workbench

ChatKit can discover iframe-based Xpert extension views and display them in a
right-side workbench. The feature is opt-in and remains disabled unless
`workbench.enabled` is exactly `true`.

```ts
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

const options: ChatKitOptions = {
  api: {
    apiUrl: 'https://api.example.com/api/ai',
    xpertId: 'assistant-id',
    getClientSecret: async () => 'client-secret',
  },
  workbench: {
    enabled: true,
    viewRail: { enabled: true },
    async onClientCommand(request) {
      // Only platform-specific operations need a host callback.
      return { success: false, code: 'unsupported', commandKey: request.commandKey };
    },
  },
};
```

`workbench.viewRail.enabled` optionally displays a compact vertical strip of view
icons at the right edge of chat when the workbench is closed. It defaults to
`false` and requires `workbench.enabled: true`. Hover or keyboard focus reveals
the localized view name and description; clicking an icon opens that view
directly, using the existing drawer on narrow screens. The rail disappears while
the workbench is open and returns when it is closed. It uses the same authorized
remote views, ordering, menu icons and labels as the workbench tabs. It does not
reserve space when no views are available, and switching Assistant or runtime
scope clears stale entries while loading the new views.

When restoring an existing thread, view discovery waits for its conversation and
Project scope to finish loading, including conversations without a Project.
ChatKit shows an initial loading state until that scope and its views are ready;
the Web Component's `chatkit.ready` event still only reports iframe document load.
Refreshing within the same scope preserves the rail, active view, previews and
injected context. Transient refresh errors retain loaded views; denied access or
a changed scope clears them. Background refreshes do not cover the chat again.

When enabled, ChatKit preloads manifests from the
`agent.workbench.fixed` slot for the configured `xpertId`. It displays only
visible `remote_component` views whose component isolation is `iframe`.
Remote HTML is fetched only after the user opens the workbench.

View discovery, entry loading, data, actions and file access sessions carry the
active `projectId` and `conversationId` through the SDK's `runtimeScope` option.
The scope comes from the host stream, never from iframe messages. The conversation
record ID is distinct from its execution thread ID. Changing the Assistant,
project or conversation disposes the old remote frame and its pending requests.
Within the same scope, switching views or opening a preview keeps visited remote
frames mounted. Changing scope clears that visited-view cache, including hidden
frames, and waits for fresh view discovery before opening new remote frames.

On wide containers the workbench is a resizable split panel. Below 960px it
opens as a right-side drawer. Maximizing hides chat at every width. Chat width
and maximized state are saved per API / organization / Assistant in local
storage; the active view remains local to the current mount.

## Theme

Remote Views inherit the existing top-level `options.theme` configuration; no
separate workbench theme is required. ChatKit resolves that configuration to
the Xpert Remote UI `mode` and `--xui-*` token set and includes it in the
iframe's `init.theme` payload. When `options.theme` changes, ChatKit sends a
fresh `init` payload so the active Remote View updates without being reloaded.

## Client commands

ChatKit handles these manifest-declared commands directly:

- `assistant.context.set` stores a keyed context. ChatKit merges every stored
  context, including string `env` values, into later chat requests.
- `assistant.chat.send_message` submits through the active ChatKit stream and
  preserves request injection, references, uploaded attachment handles,
  follow-up behavior, and thread state.

- `assistant.composer.append_references` validates and appends references without
  replacing text or existing attachments, reveals chat, and focuses the composer.
- `workbench.file.open` opens a native preview tab from an HTTP(S) URL. It accepts
  file metadata and evidence text/page anchors; repeated opens reuse the tab.
- `workbench.browser.open` opens a sandboxed browser preview tab.
- `workbench.navigation.open` with `target: 'workbench.view'` selects an available
  view and passes `selectionId` and scalar `parameters` in its `init.initialQuery`.
  Already opened views remain mounted so command replies and local state survive
  tab switches. Unknown views return `view_unavailable`.

File previews display images, or use the browser's embedded document viewer.
PDF page anchors and evidence text are supported; OCR rectangle highlighting is
not implemented. Sites that forbid embedding must be opened with the preview's
external link. URLs with executable/local schemes or embedded credentials are
rejected. Preview frames receive no ChatKit session credentials.

`assistant.chat.send_message` with `newThread: true` resets the current local
stream before submitting, even while another run is active; it is not queued on
the previous thread.

Other manifest-declared commands are forwarded to
`workbench.onClientCommand`. The callback stays in the host-side options and is
bridged internally when ChatKit is hosted through the Web Component. Missing
handlers return `{ success: false, code: 'unsupported' }`, without emitting a
global `chatkit.error`.

### Authorized conversation and project navigation

For `assistant.conversation` and `assistant.project`, ChatKit owns the runtime
switch and UI. The authenticated host owns authorization:

1. For a conversation, resolve its canonical Assistant, Project and thread via
   the platform Workbench navigation endpoint. Do not trust `payload.xpertId`.
2. Create a short-lived ChatKit session for that authorized scope. Include the
   original requesting Assistant when creating a delegated conversation session.
3. Return the following from `workbench.onClientCommand`:

```ts
import type { ChatKitWorkbenchNavigationSession } from '@xpert-ai/chatkit-types';

const session: ChatKitWorkbenchNavigationSession = {
  assistantId: 'server-resolved-assistant',
  projectId: null,
  threadId: 'server-resolved-thread', // null for a new Project conversation
  conversationId: 'requested-conversation', // required for conversation navigation
  secret: 'short-lived-scoped-secret',
  organizationId: 'current-organization',
};
return { success: true, session };
```

ChatKit validates the requested resource against the result, replies to the
source view without credentials, then remounts its stream in the new scope.
Project navigation also restores the requested `viewKey`, `selectionId`, and
`parameters`. Session refresh invokes the same host callback and rejects scope
changes. Theme updates preserve navigation; explicit parent thread / Assistant /
organization changes clear it. Hosts that already navigate their own pages may
return `{ success: true, status: 'opened' }` without a session.

Project navigation must use the host's current authorized Assistant after a
conversation switch, rather than the initial Bot or an ID supplied by a plugin.
The session endpoint still checks the selected Project's Assistant binding.
Native Side Chat shares the main stream's scoped credential renewal, including
in-flight refresh deduplication; it must not fall back to the initial Bot's secret.

### Platform-owned commands

`knowledgebase.documents`, `agent-evolution.target`, and
`platform.data-source.create` remain host callbacks because they depend on Xpert
platform pages and account permissions. A host may return `created` with only a
`dataSourceId`, or `cancelled`, after its creation dialog finishes. Merely opening
platform management must return `opened`, never `created`. Never return data
source credentials/options to the remote view. Desktop opens these platform
pages in the system browser; data-source creation still completes there and does
not currently return a newly created ID to the original plugin. Knowledge page,
chunk, and block URL anchors are preserved; transient evidence excerpts are
not put in browser URLs.

## Isolation

Remote HTML runs in a `srcDoc` iframe with `referrerPolicy="no-referrer"` and
the fixed sandbox:

```text
allow-downloads allow-forms allow-modals allow-popups allow-scripts
```

`allow-same-origin` is intentionally excluded. API calls, actions, and
workspace-file grants are performed by `@xpert-ai/xpert-sdk` in the ChatKit
host; credentials and API URLs are never sent to the remote iframe.

Direct WebSocket connections from this iframe send `Origin: null`. A remote
service must explicitly support credential-isolated frames with an authorized,
short-lived capability; never remove the iframe sandbox to make a connection
work or treat the null Origin as authentication.
