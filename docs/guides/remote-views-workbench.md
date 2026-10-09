# Remote Views Workbench

ChatKit can discover iframe-based Xpert extension views and display them in a
workbench that starts on the right. The feature is opt-in and remains disabled unless
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
    async onClientCommand(request) {
      // Only platform-specific operations need a host callback.
      return {
        success: false,
        code: 'unsupported',
        commandKey: request.commandKey,
      };
    },
  },
};
```

The stacked-tabs button in the chat header shows the number of available menu
views. Hover over it, or press Arrow Down while focused, to open a menu with each
view's icon and localized name. Selecting a view opens it in the workbench,
including on-demand views. Clicking the button directly restores the active
view or opens the first available menu view.
Switch views with the workbench tabs or open a new tab with **+**. On narrow screens,
the same button opens the workbench drawer. The chat no longer reserves a
right-side icon rail; `workbench.viewRail` is deprecated and ignored.

The **New tab** guide shows Files / folders, Terminal and Side chat as common
tools. More tools reserves an entry for future plugin and MCP Apps integrations.
Recommended contains on-demand views and closed fixed views, followed by recently
opened workspace files and website/file previews. It uses the same
authorized, menu-visible manifests as the header menu, with localized labels and
icons. Choose an item to replace the guide with that view or preview; an existing
tab is reused. Fixed views can also be closed and reopened from Recommended.
Multiple new tabs can be opened and closed independently, while
visited views and previews remain mounted during tab switches.

Search filters view names, descriptions and recent file titles. Enter an explicit
HTTP(S) URL to open a sandboxed website preview. Recently opened records are
deduplicated and ordered by last visit within each list (up to 30 workspace files
and 20 website/file previews). They remain available after
closing a preview, but are kept in memory only and cleared when the Assistant,
organization, project, conversation or authentication scope changes. Loss of view
access also clears file/website records.

When restoring an existing thread, view discovery waits for its conversation and
Project scope to finish loading, including conversations without a Project.
ChatKit shows an initial loading state until that scope and its views are ready;
the Web Component's `chatkit.ready` event still only reports iframe document load.
Refreshing within the same scope preserves the active view, previews and
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

On wide containers the workbench is a resizable split panel. Hover over the divider
or focus it with the keyboard to reveal the swap button at its center. Use it to
exchange the chat and workbench positions without
reloading either pane. Pointer and arrow-key resizing follow the new position.
Chat width, pane positions and maximized state are saved per API / organization /
Assistant in local storage; the active view remains local to the current mount.
Below 960px, the workbench opens as a right-side drawer and leaves the saved desktop
layout unchanged. Maximizing hides chat at every width.

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

Execution inspection is handled inside ChatKit first. Send `workbench.navigation.open`
with `target: 'assistant.execution'`, `conversationId`, `executionId`, and optional
`threadId` / `projectId` hints. The older `assistant.conversation` target with an
`executionId` retains the same behavior. In the active conversation and branch,
ChatKit opens the exact external execution panel (or scrolls to the root execution),
loading older messages through the SDK only when necessary. It does not reset the
thread, discard the composer draft, or ask the host to navigate.

Only targets outside the current conversation/branch fall back to the host, using
the compatible `assistant.conversation` payload. Missing records, rejected reads,
and stale requests return an error without host fallback. Frame identity and
manifest command declarations remain enforced; execution data is read with the
current session's authorization. A new selection or scope change cancels the old
selection. Each click can reopen a previously closed execution panel.

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

### Workbench opening policy

ChatKit Workbench views use the `agent.workbench.fixed` slot. `workbench.openMode`
is `auto` (the default, initially opened) or `on-demand` (opened by a menu,
navigation, or a scoped live Agent request). Both use the same view renderer,
data/actions, parameters and runtime scope. `workbench.menu.enabled: false` hides
manual entries only; it does not block an authorized view from opening through
navigation or an Agent request. Feature activation and permissions control availability.

The existing `agent.workbench.fixed` and `agent.workbench.main` APIs remain
available. ChatKit continues to request the fixed slot; opening policy is
independent of the slot name. `workbench.fixed: false` retains its disabled
semantics and must not be interpreted as `on-demand`.

### Execution focus from the host

To focus an execution, pass `threadId`, `executionId`, and a new
`executionFocusRequestId` in `request.context.env` for each explicit navigation.
The request ID prevents ordinary rerenders from reopening the panel while allowing
the user to open the same execution again after closing it.

## Native files, terminal and editors

Native tools use `Client.workbench`; there are no direct platform HTTP requests in
the UI. Without a Project, files use the current Assistant workspace. With a
Project, the conversation file API resolves the workspace on the server. File
and terminal tabs are cleared when the runtime/authentication scope changes.
Save drafts before changing Assistant, project or conversation.

Files support folder browsing, search within the current folder, new text files
(including parent paths), uploads, downloads (ZIP for folders) and confirmed
deletion. Open files remain mounted when switching tabs. Closing a dirty file
prompts to save, discard or cancel; page unload also warns about unsaved edits.
Saving checks the current server bytes first and retains the local buffer on a
conflict or failed write. This is a preflight check, not a server-side atomic lock.
Download can export a draft for recovery.

| File type                    | Workbench capability                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Text / code                  | CodeMirror editing, search, syntax modes, undo and save                                                                |
| Markdown / HTML              | Source editing plus rendered preview; HTML uses a sandboxed iframe                                                     |
| DOCX                         | Paginated document editing with formatting, tables, images, and workspace save                                         |
| CSV / TSV / XLS              | Spreadsheet editing and export in the original format                                                                  |
| XLSX                         | Cell values/formulas, preserving original package parts; unsupported structure/style changes block saving              |
| PPTX                         | Slide/text editing, basic text formatting, moving elements, editing table cells, undo/redo and package-preserving save |
| Images / PDF / audio / video | Browser-supported preview and download                                                                                 |
| Other formats                | Download                                                                                                               |

Office editors load lazily. Editable text is limited to 5 MiB and all previews to
50 MiB; larger files remain downloadable. See [Office editing](../office-workbench.md)
for supported operations, preservation guarantees, and format-specific limitations.
The editors do not claim full Microsoft Office feature compatibility.

Terminal uses xterm and the existing `sandbox-terminal` Socket.IO protocol,
including resize, input, disconnect/reconnect and disposal on close/scope changes.
It requires a conversation with a sandbox provider that implements terminal
sessions. Side chat copies the source execution thread and is enabled by default
with Workbench; `workbench.sideChat.enabled: false` disables it explicitly.

## SDK and server prerequisites

Workbench requires `@xpert-ai/xpert-sdk` 0.6.0 or later. This release provides
`Client.workbench` file and terminal methods, immutable artifact downloads, and
remote View context events. Socket.IO is included as an SDK dependency; no pnpm
patch or package extension is required. Install the checked-in dependency versions
with `corepack pnpm install --frozen-lockfile`.

### Local testing with the released SDK

Use the published SDK package for local development. After upgrading from a
patched version, stop the existing ChatKit development server, then run these
commands from the `chatkit-js` repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev:ui:fresh
```

`dev:ui:fresh` verifies that the installed SDK exposes the Workbench file,
artifact-download, and terminal methods, then starts Vite on port 5173 with fresh dependency optimization.
It fails if that port is occupied instead of silently switching ports. To check
the installed SDK separately, run `corepack pnpm check:sdk`.

Stop Vite before reinstalling dependencies or removing its `.vite` cache, then
restart it with `corepack pnpm dev:ui:fresh`. A running server can retain module
URLs whose prebundled files no longer exist. This causes `504 Outdated Optimize
Dep` when opening a lazy view such as Terminal, even while already loaded views
still work. Restart the server before reloading the host page; a browser refresh
alone cannot restore missing server-side cache files.

Native workbench tabs isolate module-loading and rendering errors. A failed tab
offers an explicit reload of the ChatKit frame, with a reminder to save changes
in other tabs first. It never automatically reloads the frame or resets other
tabs. Reloading clears React's cached lazy-import failure; closing and reopening
the same failed view is not sufficient.

Terminal uses xterm 6 and its matching Fit addon. This includes the upstream
cleanup fix for a deferred viewport callback firing after terminal disposal,
which React StrictMode can expose during development. Resize and transport
callbacks also ignore disposed sessions; language changes do not reconnect them.

The terminal protocol reports stable restriction codes (`computer_desktop_required`,
`unsupported_provider`, or `sandbox_disabled`). After the first response, ChatKit
shows localized guidance and disables further terminal launches for that conversation
in the current workbench. Switching context or reloading rechecks availability.
Computer users must take control in the Computer view and use its desktop terminal.
This does not grant independent terminal access to Computer. Transient connection
errors still offer Reconnect. Older servers retain their ordinary error display
until they provide these codes.

The local Xpert host should use `VITE_CHATKIT_FRAME_URL=http://localhost:5173`.
After restarting Vite, fully reload the host page (for example,
`http://localhost:4300/chat/clawxpert/c`) to recreate the SDK client inside the
iframe. Hot module replacement can retain an older client instance even after
the installed package has been updated. On macOS Chrome, use Cmd+Shift+R.

If `client.workbench` is undefined, check the installed SDK and reload the page
before debugging the file API. Connection-refused and HTTP 401 errors are separate
backend connectivity or authentication failures; rebuilding the SDK alone does
not resolve them. Terminal authentication uses the SDK request hook so both HTTP
and Socket.IO receive the current client secret and organization context.

Deploy the matching Xpert changes before using the tools: the Assistant workspace
routes accept the scoped interactive credential, the conversation file controller
uses the existing workspace services, and the terminal guard accepts USER_XPERT
client secrets in addition to JWT. Assistant/tenant/organization bindings and the
existing project/user permissions remain enforced. Public and enterprise client
secrets do not gain native workspace access.

Sandbox service discovery runs in the background when restoring history; its
loading and error state belongs to the runtime services panel and does not block
Workbench readiness. The matching server treats service listing as passive:
it authorizes the conversation, reads persisted services, and inspects only an
existing runtime. Missing runtimes report active services as `lost`; discovery
does not provision workspace directories or create/recover a sandbox. Terminal
and explicit execution/start operations retain their on-demand runtime creation.
Missing provider or workspace mapping configuration returns a structured 400
error so the SDK does not repeatedly retry it.

See [Native Workbench tools and file views](./workbench-native-tools.md).
