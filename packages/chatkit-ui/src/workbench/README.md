# Workbench views

Keep each view's components, helpers, styles, and tests in its feature directory.

- `browser-preview/`: browser navigation, address entry, and recent-page suggestions.
- `html-preview/`: saved HTML artifacts, annotations, developer tools, and preview runtime.
- `url-preview/`: shared URL rendering for browser pages, images, and file evidence.
- `file-review/`: file-change loading, review, and diff rendering.
- `remote-view/`: plugin View iframe hosting and its lifecycle tests.
- `external-assistant/`: external assistant execution and activity presentation.
- `side-chat/`: the side conversation view, its session types, and close confirmation.
- `start-page/`: the new-tab page and its launchers.
- `code-editor/`: the code editor shared by file editing, HTML source, and diffs.
- `native/files/`: workspace browsing, file editing, and file preview dispatch.
- `native/terminal/`: the workspace terminal.
- `native/office/document/`, `spreadsheet/`, and `presentation/`: Office editors
  with their format-specific parsing, preservation, styles, and tests.

The Workbench root owns shared navigation, tabs, commands, and preview dispatch.
`native/` owns the common native-tab lifecycle; `shell/` owns shared session and
layout coordination. Keep these shared responsibilities outside individual views.
