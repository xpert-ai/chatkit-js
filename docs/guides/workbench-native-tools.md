# Native Workbench Tools and File Views

Workbench provides native file browsing, editing, terminals, and side chats alongside remote views. The start page offers available tools, recommended views, recent items, and a search or URL entry point. Plugin and MCP App tool discovery remains an extension point; unavailable tools are not presented as installed capabilities.

## Requirements

- Use the published `@xpert-ai/xpert-sdk` version `0.6.0` or later. ChatKit no longer uses the local patch for SDK `0.5.0` or supplementary dependency declarations.
- Deploy the corresponding Xpert conversation-file endpoints and restricted ChatKit client-secret authentication for files and terminals.
- Authorize the current Assistant/Project scope. The server checks Assistant, tenant, and organization bindings; a successful login alone does not establish access to a workspace.
- Terminal access requires a sandbox provider with PTY support.

All Xpert requests go through the SDK. The UI resolves the actual workspace through conversation APIs, including Project conversations, rather than constructing server disk paths or reading browser credentials.

## Files and folders

The file view supports lazy directory loading, search, file creation, upload, download, deletion, and type-specific editing or preview. Directory entries use `hasChildren`; `children: null` means the directory has not been loaded yet.

Editors maintain their own working buffers. Workbench handles authenticated reads and writes, scope, conflict checks, persistence, and close confirmation. A failed save retains the buffer. Downloading a draft does not mark it as saved; only a successful server write advances the saved baseline. Creation checks protect existing files from accidental replacement.

The current conflict check downloads and compares the saved file before writing. It is not an atomic conditional write: another writer can change the file between comparison and persistence. Atomic conflict protection requires server version or ETag support and a matching SDK contract.

| File type                 | Behavior                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| Text and code             | Code editor and workspace save                                    |
| Markdown                  | Editing and rendered preview                                      |
| HTML                      | Editing and isolated browser preview                              |
| DOCX                      | Paginated document editor with formatting, tables, and images     |
| CSV/XLS/XLSX              | Spreadsheet view; supported edits depend on the format and writer |
| PPTX                      | Presentation canvas with supported object and slide editing       |
| Images, PDF, audio, video | Browser-supported media previews                                  |

Office editors load on demand. They preserve unmodified package content and reject unsupported writes instead of silently discarding data. See [Office editing](../office-workbench.md) for the supported operations and format-specific limitations.

Recent items belong to the current runtime scope. Save open files before changing Assistant, Project, or conversation; data and editing state must not leak between scopes.

## Terminals

The terminal uses xterm and FitAddon with the SDK's Socket.IO connection to the `sandbox-terminal` namespace. It supports session open, input, resize, close, connection status, and reconnection. Closing a terminal or changing its scope releases the session.

## Tabs and side chats

Each start page and visited preview has its own tab state. Native tools reuse the existing Workbench scope and view lifecycle. Side chats use the production Chat component and an independent thread; see [Native side chats and thread branching](./side-chat.md) for configuration, reuse, and draft behavior.

## Implementation map

Paths below are relative to `packages/chatkit-ui/src/workbench/`.

| Module                                  | Responsibility                                                |
| --------------------------------------- | ------------------------------------------------------------- |
| `start-page/WorkbenchStartPage.tsx`     | Native tools, recommendations, recent items, search, and URLs |
| `shell/`                                | Tab, command, layout, and side-chat orchestration             |
| `native/files/`                         | Workspace browsing, editors, previews, and file utilities     |
| `native/terminal/WorkbenchTerminal.tsx` | Terminal connection, sizing, and cleanup                      |
| `native/office/`                        | Document, spreadsheet, and presentation editors               |
| `html-preview/`                         | HTML artifact preview, annotations, and developer panels      |
| `file-review/`                          | File change review and diffs                                  |
| `remote-view/`                          | Isolated remote view frames                                   |

The SDK protocol lives in `xpert-sdk-js/packages/core/src/workbench.ts`. Xpert owns the file routes, client-secret guards, workspace authorization, and terminal gateway. Angular file and terminal components were behavior references; ChatKit owns the native React implementation.

## Verification and limits

Initial implementation verification covered SDK HTTP, binary responses, authentication hooks, terminal protocol, scope isolation, file creation protection, save failures, and dirty-close confirmation. The initial UI run passed 1,296 tests in 139 files, followed by two additional file-creation tests. Platform checks passed 37 authorization/file/terminal tests and 22 PPTX regression tests. These are historical results, not a claim about the current full suite.

Local browser acceptance used the real UI with an in-memory SDK transport to verify Office edit/save/reopen, Markdown and HTML previews, folders, light and dark themes, and a 360px panel. The `sharp` theme produced zero-radius tool buttons. Type checks and library/app builds passed; large lazy Office chunks remained a build warning. At that time lint could not run because ESLint 9 had no flat configuration.

Those fixtures did not validate a real organization's file authorization or sandbox PTY. Deployment acceptance must exercise both with an authorized Assistant/Project session. Media support depends on the browser; the Office views do not claim full Microsoft Office compatibility.
